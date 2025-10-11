export default Array.from(
  (await Bun.$`bun run audit`.text()).split('\n').filter(Boolean).filter(isNotNull),
)
  .slice(-1)[0]?.includes('Passed') ?? false
  ? // <...expression(s)> |echo ?$
    (console.log('0'), process.exit(0))
  : (console.log('1'), process.exit(1));
