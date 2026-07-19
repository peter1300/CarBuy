import { useState } from 'react'
import type { Listing } from '../data/listings'
import { useLocale } from '../i18n/LocaleContext'

export type DeletionReason = 'sold_carbuy' | 'sold_elsewhere' | 'not_sold'

type Step = 'ask_sold' | 'ask_where' | 'confirm'

interface DeleteListingDialogProps {
  listing: Listing
  onConfirm: (reason: DeletionReason) => void
  onCancel: () => void
}

export function DeleteListingDialog({ listing, onConfirm, onCancel }: DeleteListingDialogProps) {
  const { t } = useLocale()
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
            <h2 className="dialog__title">{t('delete.title')}</h2>
            <p className="dialog__text">
              {t('delete.confirmText', { title: listing.title })}
            </p>
            <p className="dialog__question">{t('delete.askSold')}</p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--accent" onClick={handleSoldYes}>
                {t('delete.soldYes')}
              </button>
              <button type="button" className="btn btn--outline" onClick={handleSoldNo}>
                {t('delete.soldNo')}
              </button>
            </div>
            <button type="button" className="dialog__cancel" onClick={onCancel}>
              {t('delete.cancel')}
            </button>
          </>
        )}

        {step === 'ask_where' && (
          <>
            <h2 className="dialog__title">{t('delete.congrats')}</h2>
            <p className="dialog__question">{t('delete.askWhere')}</p>
            <div className="dialog__actions dialog__actions--vertical">
              <button
                type="button"
                className="btn btn--accent btn--lg"
                onClick={() => handleWhere(true)}
              >
                {t('delete.onCarbuy')}
              </button>
              <button
                type="button"
                className="btn btn--outline btn--lg"
                onClick={() => handleWhere(false)}
              >
                {t('delete.elsewhere')}
              </button>
            </div>
            <button type="button" className="dialog__cancel" onClick={onCancel}>
              {t('delete.cancel')}
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h2 className="dialog__title">
              {reason === 'sold_carbuy'
                ? t('delete.thanksCarbuy')
                : reason === 'sold_elsewhere'
                  ? t('delete.thanksElsewhere')
                  : t('delete.title')}
            </h2>
            <p className="dialog__text">
              {reason === 'sold_carbuy'
                ? t('delete.bodyCarbuy')
                : reason === 'sold_elsewhere'
                  ? t('delete.bodyElsewhere')
                  : t('delete.bodyNotSold')}
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--accent" onClick={handleConfirm}>
                {reason === 'not_sold' ? t('delete.confirmNotSold') : t('delete.confirmBtn')}
              </button>
              <button type="button" className="btn btn--outline" onClick={onCancel}>
                {t('delete.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
