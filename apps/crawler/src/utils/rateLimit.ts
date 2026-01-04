export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Enforces a minimum delay between operations.
 * @param ms Minimum delay in milliseconds (default: 500ms)
 */
export const rateLimit = async (ms: number = 500): Promise<void> => {
    await sleep(ms);
};
