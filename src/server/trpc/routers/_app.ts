import { createTRPCRouter } from '../init';
import { authRouter } from './auth';
import { docenteRouter } from './docente';
import { cursoRouter } from './curso';
import { aulaRouter } from './aula';
import { periodoRouter } from './periodo';
import { horarioRouter } from './horario';
import { reporteRouter } from './reporte';
import { notificationRouter } from './notification';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  docente: docenteRouter,
  curso: cursoRouter,
  aula: aulaRouter,
  periodo: periodoRouter,
  horario: horarioRouter,
  reporte: reporteRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;

