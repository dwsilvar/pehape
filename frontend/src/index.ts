export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// If executed directly (node ./dist/index.js) print a greeting
if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log(greet('World'));
}
