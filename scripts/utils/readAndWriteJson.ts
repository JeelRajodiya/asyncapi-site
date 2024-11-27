import { readFile, writeFile } from 'fs/promises';

import { convertToJson } from '../utils';

export async function writeJSON(readPath: string, writePath: string) {
  let readContent;
  let jsonContent;

  // Attempt to read the file
  try {
    readContent = await readFile(readPath, 'utf-8');
  } catch (err) {
    throw new Error(`Error while reading file\nError: ${err}`);
  }

  // Attempt to convert content to JSON
  try {
    jsonContent = convertToJson(readContent);
  } catch (err) {
    throw new Error(`Error while conversion\nError: ${err}`);
  }

  // Attempt to write the JSON content to file
  try {
    await writeFile(writePath, JSON.stringify(jsonContent));
  } catch (err) {
    throw new Error(`Error while writing file\nError: ${err}`);
  }
}
