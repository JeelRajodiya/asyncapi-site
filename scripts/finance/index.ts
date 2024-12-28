import assert from 'assert';
import { mkdir } from 'fs/promises';
import { resolve } from 'path';

import writeJSON from '../utils/readAndWriteJson';

interface BuildFinanceInfoListProps {
  currentDir: string;
  configDir: string;
  financeDir: string;
  year: string;
  jsonDataDir: string;
}

export default async function buildFinanceInfoList({
  currentDir,
  configDir,
  financeDir,
  year,
  jsonDataDir
}: BuildFinanceInfoListProps) {
  try {
    const expensesPath = resolve(currentDir, configDir, financeDir, year, 'Expenses.yml');
    const expensesLinkPath = resolve(currentDir, configDir, financeDir, year, 'ExpensesLink.yml');

    // Ensure the directory exists before writing the files
    const jsonDirectory = resolve(currentDir, configDir, financeDir, jsonDataDir);

    await mkdir(jsonDirectory, { recursive: true });

    // Write Expenses and ExpensesLink to JSON files
    const expensesJsonPath = resolve(jsonDirectory, 'Expenses.json');

    await writeJSON(expensesPath, expensesJsonPath);

    const expensesLinkJsonPath = resolve(jsonDirectory, 'ExpensesLink.json');

    await writeJSON(expensesLinkPath, expensesLinkJsonPath);
  } catch (err) {
    assert(err instanceof Error);
    throw new Error(err.message);
  }
}
