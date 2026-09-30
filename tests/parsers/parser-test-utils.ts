import { VERSION } from '@angular/compiler';

const majorVersion = parseInt(VERSION.major, 10);

export const isAngular21OrAbove = majorVersion >= 21;
export const isAngular22OrAbove = majorVersion >= 22;
