/**
 * Coordination between the global "Escape closes the topmost modal" handler
 * (ModalProvider) and the ConfirmDialog. When a ConfirmDialog is open it sits
 * on top of a panel modal, so pressing Escape should cancel the confirm and NOT
 * also close the panel underneath. ConfirmDialog increments the counter while
 * open; the global handler defers when any confirm is open.
 */
let confirmOpenCount = 0;

export function openConfirmDialog(): void {
  confirmOpenCount += 1;
}

export function closeConfirmDialog(): void {
  confirmOpenCount = Math.max(0, confirmOpenCount - 1);
}

export function isConfirmDialogOpen(): boolean {
  return confirmOpenCount > 0;
}
