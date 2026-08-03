import { hwidUserBody } from './hwid-user-ref';

describe('hwidUserBody', () => {
    it('maps a numeric reference (panel >=3.x) to a numeric userId', () => {
        expect(hwidUserBody('123')).toEqual({ userId: 123 });
    });

    it('maps a uuid reference (panel 2.x) to userUuid', () => {
        expect(hwidUserBody('0b3cb0e8-19a4-4c14-b198-fdbb3f2ba9e2')).toEqual({
            userUuid: '0b3cb0e8-19a4-4c14-b198-fdbb3f2ba9e2',
        });
    });

    it('treats a mixed alphanumeric reference as uuid, not a number', () => {
        expect(hwidUserBody('123abc')).toEqual({ userUuid: '123abc' });
    });
});
