import { createTRPCRouter } from '../init';
import { authRouter } from './auth';
import { docenteRouter } from './docente';
import { cursoRouter } from './curso';
import { aulaRouter } from './aula';
import { periodoRouter } from './periodo';
import { horarioRouter } from './horario';
import { reporteRouter } from './reporte';
import { notificationRouter } from './notification';
import { facultadRouter } from './facultad';
import { departamentoRouter } from './departamento';
import { escuelaRouter } from './escuela';
import { cargaLectivaRouter } from './cargaLectiva';
import { cargaNoLectivaRouter } from './cargaNoLectiva';
import { declaracionRouter } from './declaracion';
import { declaracionPDFRouter } from './declaracionPDF';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  docente: docenteRouter,
  curso: cursoRouter,
  aula: aulaRouter,
  periodo: periodoRouter,
  horario: horarioRouter,
  reporte: reporteRouter,
  notification: notificationRouter,
  facultad: facultadRouter,
  departamento: departamentoRouter,
  escuela: escuelaRouter,
  cargaLectiva: cargaLectivaRouter,
  cargaNoLectiva: cargaNoLectivaRouter,
  declaracion: declaracionRouter,
  declaracionPDF: declaracionPDFRouter,
});

export type AppRouter = typeof appRouter;

