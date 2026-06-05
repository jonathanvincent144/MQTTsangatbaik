import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  
  if (typeof (window as any).process === 'undefined') {
    (window as any).process = {
      cfg: {},
      env: { NODE_ENV: 'development' },
      nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
      title: 'browser',
      browser: true,
      argv: [],
      binding: () => { throw new Error('No bindings in browser'); },
    };
  }
}
