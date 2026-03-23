import type { NextFunction, Request, Response } from "express";
import { vi } from "vitest";

export function createMockRequest(
    overrides: Partial<Request> = {},
): Request {
    return overrides as Request;
}

export function createMockResponse(): Response {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res) as Response["status"];
    res.json = vi.fn().mockReturnValue(res) as Response["json"];
    res.locals = {};
    return res;
}

export function createMockNext(): NextFunction {
    return vi.fn() as NextFunction;
}
