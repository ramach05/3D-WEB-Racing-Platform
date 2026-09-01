const [major, minor] = process.versions.node.split('.').map(Number);
const ok = major > 22 || (major === 22 && minor >= 12);

if (!ok) {
  console.error(
    `\n❌ Требуется Node.js 22.12+, сейчас: v${process.versions.node}\n` +
      '   Выполните: nvm use\n' +
      '   (или установите: nvm install 22.12.0)\n',
  );
  process.exit(1);
}
