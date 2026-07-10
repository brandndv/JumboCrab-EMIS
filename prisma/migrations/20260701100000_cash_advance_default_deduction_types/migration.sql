INSERT INTO "DeductionType" (
    "id",
    "code",
    "name",
    "description",
    "amountMode",
    "frequency",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES
    (
        'cash-advance-installment-default',
        'CASH_ADVANCE',
        'Cash Advance - Installment',
        'Cash advance repayment split across payroll periods.',
        'FIXED',
        'INSTALLMENT',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'cash-advance-one-time-default',
        'CASH_ADVANCE_ONE_TIME',
        'Cash Advance - One Time',
        'Cash advance repayment deducted once on the selected payroll.',
        'FIXED',
        'ONE_TIME',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "amountMode" = EXCLUDED."amountMode",
    "frequency" = EXCLUDED."frequency",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;
