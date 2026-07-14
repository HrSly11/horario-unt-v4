import { describe, expect, it } from 'vitest';
import { resolveManualOptionStatus } from './utils';



describe('AsignacionPage manual scheduling UX helpers', () => {
  it('marks a component with remaining blocks as schedulable', () => {
    expect(resolveManualOptionStatus({ horasAsignadas: 3, scheduledBlocks: 1, remainingBlocks: 2 })).toEqual({
      label: '2 bloques pendientes',
      badgeClass: 'badge badge-warning',
      disabled: false,
    });
  });

  it('marks a fully scheduled component as complete and disabled', () => {
    expect(resolveManualOptionStatus({ horasAsignadas: 2, scheduledBlocks: 2, remainingBlocks: 0 })).toEqual({
      label: 'Completo',
      badgeClass: 'badge badge-success',
      disabled: true,
    });
  });
});
