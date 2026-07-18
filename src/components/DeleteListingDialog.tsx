import { useState } from 'react'
import type { Listing } from '../data/listings'

export type DeletionReason = 'sold_carbuy' | 'sold_elsewhere' | 'not_sold'

type Step = 'ask_sold' | 'ask_where' | 'confirm'

interface DeleteListingDialogProps {
  listing: Listing
  onConfirm: (reason: DeletionReason) => void
  onCancel: () => void
}

export function DeleteListingDialog({ listing, onConfirm, onCancel }: DeleteListingDialogProps) {
  const [step, setStep] = useState<Step>('ask_sold')
  const [reason, setReason] = useState<DeletionReason | null>(null)

  const handleSoldYes = () => {
    setStep('ask_where')
  }

  const handleSoldNo = () => {
    setReason('not_sold')
    setStep('confirm')
  }

  const handleWhere = (soldOnCarbuy: boolean) => {
    const r = soldOnCarbuy ? 'sold_carbuy' : 'sold_elsewhere'
    setReason(r)
    setStep('confirm')
  }

  const handleConfirm = () => {
    if (reason) {
      onConfirm(reason)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {step === 'ask_sold' && (
          <>
            <h2 className="dialog__title">Hirdetés törlése</h2>
            <p className="dialog__text">
              Biztosan törölni szeretnéd a(z) <strong>{listing.title}</strong> hirdetést?
            </p>
            <p className="dialog__question">Eladtad az autót?</p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--accent" onClick={handleSoldYes}>
                Igen, eladtam
              </button>
              <button type="button" className="btn btn--outline" onClick={handleSoldNo}>
                Nem, még nem adtam el
              </button>
            </div>
            <button type="button" className="dialog__cancel" onClick={onCancel}>
              Mégsem
            </button>
          </>
        )}

        {step === 'ask_where' && (
          <>
            <h2 className="dialog__title">Gratulálunk az eladáshoz!</h2>
            <p className="dialog__question">Hol találtad a vevőt?</p>
            <div className="dialog__actions dialog__actions--vertical">
              <button
                type="button"
                className="btn btn--accent btn--lg"
                onClick={() => handleWhere(true)}
              >
                A CarBuy-on
              </button>
              <button
                type="button"
                className="btn btn--outline btn--lg"
                onClick={() => handleWhere(false)}
              >
                Máshol
              </button>
            </div>
            <button type="button" className="dialog__cancel" onClick={onCancel}>
              Mégsem
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h2 className="dialog__title">
              {reason === 'sold_carbuy'
                ? 'Köszönjük, hogy a CarBuy-t választottad!'
                : reason === 'sold_elsewhere'
                  ? 'Köszönjük a visszajelzést!'
                  : 'Hirdetés törlése'}
            </h2>
            <p className="dialog__text">
              {reason === 'sold_carbuy'
                ? 'Örülünk, hogy segíthettünk a vevő megtalálásában. A hirdetésed most törlésre kerül.'
                : reason === 'sold_elsewhere'
                  ? 'Legközelebb nálunk is hirdess! A hirdetésed most törlésre kerül.'
                  : 'A hirdetésed törlésre kerül. Később bármikor feladhatsz újat.'}
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--accent" onClick={handleConfirm}>
                Törlés megerősítése
              </button>
              <button type="button" className="btn btn--outline" onClick={onCancel}>
                Mégsem
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
