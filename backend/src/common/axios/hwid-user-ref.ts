// Panel >=3.x identifies users by numeric id in the HWID API, 2.x by uuid.
// The reference's own shape picks the request format — no version probing needed.
export function hwidUserBody(userRef: string): { userId: number } | { userUuid: string } {
    return /^\d+$/.test(userRef) ? { userId: Number(userRef) } : { userUuid: userRef };
}
