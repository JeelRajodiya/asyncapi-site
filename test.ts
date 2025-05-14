import { logger } from './scripts/utils/logger';

logger.error({
  message: 'Tool title is missing during sort',
  detail: ' { tool, anotherTool },',
  source: 'combine-tools.ts'
});

const myArr = [{ title: 'a' }];

myArr.tool = 'a';
console.log(myArr);
