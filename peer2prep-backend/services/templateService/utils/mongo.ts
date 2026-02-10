export const mongooseToJson = <T = any>(doc: any): T | null => {
    if (!doc) return null;

    const json = doc.toObject({
        versionKey: false,
        transform: (_: unknown, ret: Record<string, any>) => {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        },
    });

    return json;
};
