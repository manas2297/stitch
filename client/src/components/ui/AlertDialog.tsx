import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

export function ConfirmAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Continue',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'destructive',
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'destructive';
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        />
        <AlertDialogPrimitive.Content
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100000,
            width: '90vw',
            maxWidth: '420px',
            backgroundColor: 'rgba(17, 21, 35, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: variant === 'destructive' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: variant === 'destructive' ? '#f87171' : '#818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0,
              }}
            >
              {variant === 'destructive' ? '⚠️' : 'ℹ️'}
            </div>
            <div style={{ flex: 1 }}>
              <AlertDialogPrimitive.Title
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: '#f8fafc',
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </AlertDialogPrimitive.Title>
              {description && (
                <AlertDialogPrimitive.Description
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: '0.875rem',
                    color: '#94a3b8',
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </AlertDialogPrimitive.Description>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              marginTop: '8px',
            }}
          >
            <AlertDialogPrimitive.Cancel asChild>
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                {cancelText}
              </button>
            </AlertDialogPrimitive.Cancel>

            <AlertDialogPrimitive.Action asChild>
              <button
                type="button"
                onClick={onConfirm}
                className="btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: variant === 'destructive' ? '#dc2626' : 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  boxShadow: variant === 'destructive' ? '0 0 15px rgba(220, 38, 38, 0.4)' : undefined,
                }}
              >
                {confirmText}
              </button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
