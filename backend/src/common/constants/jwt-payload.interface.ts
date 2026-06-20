export interface IJwtPayload {
    sessionId: string;
    su: string;
    // shortUuid of the subscription the session was issued for; binds /api/pay to its owner
    sub?: string;
}
