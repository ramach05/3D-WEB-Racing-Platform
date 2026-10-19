const [major, minor] = process.versions.node.split('.').map(Number);
const ok = major > 22 || (major === 22 && minor >= 12);

if (!ok) {
  console.error(
    `\n❌ Node.js 22.12+ required, current: v${process.versions.node}\n` +
      '   Run: nvm use\n' +
      '   (or install: nvm install 22.12.0)\n',
  );
  process.exit(1);
}
