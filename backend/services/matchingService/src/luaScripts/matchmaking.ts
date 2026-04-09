export const FIND_MATCH_LUA_SCRIPT = `
-- KEYS:
-- 1...n:   Queue keys (mm:q:topic:diff:lang)
-- n+1:     Seeker's status key (mm:us:userId)

-- ARGV:
-- 1: now (timestamp in ms)
-- 2: numQueues
-- 3: queueKeysJson (JSON array of the KEYS[1...n])
-- 4: seekerScore
-- 5: seekerRange

local now           = tonumber(ARGV[1])
local numQueues     = tonumber(ARGV[2])
local queueKeysJson = ARGV[3]
local seekerScore   = tonumber(ARGV[4])
local seekerRange   = tonumber(ARGV[5])
local seekerKey     = KEYS[numQueues + 1]

local maxCandidatesPerQueue = 50
local gracePeriodMs = 5000

local function remove_from_all_queues(userKey)
    local keysRaw = redis.call('HGET', userKey, 'queues')
    if keysRaw then
        local queueKeys = cjson.decode(keysRaw)
        for _, qKey in ipairs(queueKeys) do
            redis.call('ZREM', qKey, userKey)
        end
    end
    redis.call('DEL', userKey)
end

local existingStartTime = now
if redis.call('EXISTS', seekerKey) == 1 then
    local st = redis.call('HGET', seekerKey, 'start_time')
    local status = redis.call('HGET', seekerKey, 'status')
    local lastSeen = tonumber(redis.call('HGET', seekerKey, 'last_seen') or 0)
    
    if st then 
        if status == 'DISCONNECTED' and (now - lastSeen) > gracePeriodMs then
            existingStartTime = now
        else
            existingStartTime = tonumber(st) 
        end
    end
    
    remove_from_all_queues(seekerKey)
end

for i = 1, numQueues do
    local queueKey = KEYS[i]
    local candidateKeys = redis.call('ZRANGE', queueKey, 0, maxCandidatesPerQueue - 1)

    for _, candidateKey in ipairs(candidateKeys) do
        if candidateKey ~= seekerKey then
            local data = redis.call('HMGET', candidateKey, 'status', 'last_seen', 'score')
            local status = data[1]
            
            if not status then
                redis.call('ZREM', queueKey, candidateKey)
            else
                local lastSeen = tonumber(data[2] or 0)
                local candScore = tonumber(data[3] or 0)

                if status == 'DISCONNECTED' then
                    if (now - lastSeen) > gracePeriodMs then
                        remove_from_all_queues(candidateKey)
                    end
                elseif status == 'READY' then
                    if math.abs(seekerScore - candScore) <= seekerRange then
                        remove_from_all_queues(candidateKey)
                        remove_from_all_queues(seekerKey)
                        
                        local matchedPartnerId = candidateKey:match("([^:]+)$")
                        local matchedTopic, matchedDiff, matchedLang = queueKey:match("([^:]+):([^:]+):([^:]+)$")
                        return { 'matched', matchedPartnerId, matchedTopic, matchedDiff, matchedLang, tostring(existingStartTime) }
                    end
                end
            end
        end
    end
end

for i = 1, numQueues do
    redis.call('ZADD', KEYS[i], now, seekerKey)
end

redis.call('HSET', seekerKey, 'queues', queueKeysJson, 'status', 'READY', 'last_seen', now, 'start_time', existingStartTime, 'score', seekerScore)

return { 'enqueued', '', '', '', '', tostring(existingStartTime) }
`;

export const ATTEMPT_REJOIN_LUA_SCRIPT = `
-- KEYS: 1: Seeker's metadata key (mm:us:userId)
-- ARGV: 1: now (timestamp)

local seekerKey = KEYS[1]
local now = tonumber(ARGV[1])
local gracePeriodMs = 5000

local data = redis.call('HMGET', seekerKey, 'status', 'last_seen', 'start_time')
local status = data[1]

if not status then
    return { 'fail' }
end

local lastSeen = tonumber(data[2] or 0)
local startTime = data[3] or tostring(now)

if status == 'READY' then
    return { 'success', startTime }
elseif status == 'DISCONNECTED' then
    if (now - lastSeen) > gracePeriodMs then
        return { 'fail' }
    else
        redis.call('HSET', seekerKey, 'status', 'READY', 'last_seen', now)
        return { 'success', startTime }
    end
else
    redis.call('DEL', seekerKey)
    return { 'fail' }
end
`;

export const DISCONNECT_LUA_SCRIPT = `
-- KEYS: 1: Seeker's metadata key (mm:us:userId)
-- ARGV: 1: now (timestamp)

local seekerKey = KEYS[1]
local now = ARGV[1]

if redis.call('EXISTS', seekerKey) == 1 then
    redis.call('HSET', seekerKey, 'status', 'DISCONNECTED', 'last_seen', now)
end
return { 'ok' }
`;

export const CANCEL_MATCH_LUA_SCRIPT = `
-- KEYS: 1: Seeker's metadata key (mm:us:userId)

local seekerKey = KEYS[1]

if redis.call('EXISTS', seekerKey) == 1 then
    local keysRaw = redis.call('HGET', seekerKey, 'queues')
    if keysRaw then
        local queueKeys = cjson.decode(keysRaw)
        for _, qKey in ipairs(queueKeys) do
            redis.call('ZREM', qKey, seekerKey)
        end
    end
    redis.call('DEL', seekerKey)
end
return { 'ok' }
`;
