import { Pool } from 'pg';

export type RepaymentInstallment = {
  installmentNumber: number;
  dueDate: string;
  principalMinor: bigint;
  interestMinor: bigint;
  balanceMinor: bigint;
};

export type LoanApplicationRecord = {
  applicationId: string;
  applicantUserId: string;
  principalMinor: bigint;
  termMonths: number;
  aprBasisPoints: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'declined' | 'cancelled';
  schedule: RepaymentInstallment[];
};

export type TransactionFeeTier = {
  minAmountKes: number;
  maxAmountKes: number;
  feeKes: number;
};

let pool: Pool | undefined;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  pool ??= new Pool({
    connectionString,
    max: 10,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
  });
  return pool;
}

export async function checkPostgres() {
  await getPool().query('SELECT 1');
}

export async function closePostgres() {
  await pool?.end();
  pool = undefined;
}

export async function saveLoanApplication(record: LoanApplicationRecord) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO loan_applications
        (application_id, applicant_user_id, principal_minor, term_months, apr_basis_points, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.applicationId,
        record.applicantUserId,
        record.principalMinor.toString(),
        record.termMonths,
        record.aprBasisPoints,
        record.status,
      ],
    );

    for (const installment of record.schedule) {
      await client.query(
        `INSERT INTO repayment_schedule
          (application_id, installment_number, due_date, principal_minor, interest_minor, balance_minor)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          record.applicationId,
          installment.installmentNumber,
          installment.dueDate,
          installment.principalMinor.toString(),
          installment.interestMinor.toString(),
          installment.balanceMinor.toString(),
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getTransactionFee(amountKes: number): Promise<TransactionFeeTier> {
  if (!Number.isSafeInteger(amountKes)) {
    throw new TypeError('Transaction amount must be a whole number of KSh');
  }

  const result = await getPool().query<{
    min_amount_kes: number;
    max_amount_kes: number;
    fee_kes: number;
  }>(
    `SELECT min_amount_kes, max_amount_kes, fee_kes
     FROM transaction_fee_tiers
     WHERE $1 BETWEEN min_amount_kes AND max_amount_kes`,
    [amountKes],
  );

  if (result.rowCount !== 1) {
    throw new RangeError(`No transaction fee is configured for KSh ${amountKes}`);
  }

  const tier = result.rows[0];
  return {
    minAmountKes: tier.min_amount_kes,
    maxAmountKes: tier.max_amount_kes,
    feeKes: tier.fee_kes,
  };
}