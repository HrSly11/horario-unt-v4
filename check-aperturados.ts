import { PrismaClient } from './src/generated/prisma';
const p = new PrismaClient();
async function main() {
  const count = await p.curso.count({ where: { aperturado: true } });
  const sample = await p.curso.findMany({ where: { aperturado: true }, select: { codigo: true, ciclo: true }, take: 5 });
  console.log('aperturado=true count:', count);
  console.log('sample:', JSON.stringify(sample, null, 2));
}
main().finally(() => p.$disconnect());
