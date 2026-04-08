import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

export function useMercadoPago(publicKey: string | null | undefined) {
  const mpRef = useRef<any>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!publicKey || loadedRef.current) return;

    const existing = document.getElementById('mp-sdk');
    if (existing) {
      if (window.MercadoPago) {
        mpRef.current = new window.MercadoPago(publicKey);
        loadedRef.current = true;
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'mp-sdk';
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.MercadoPago) {
        mpRef.current = new window.MercadoPago(publicKey);
        loadedRef.current = true;
      }
    };
    document.head.appendChild(script);
  }, [publicKey]);

  /**
   * Tokenize card data using MercadoPago.js SDK.
   * Returns the card token string or throws an error.
   */
  const tokenizeCard = async (cardData: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }): Promise<{ token: string; paymentMethodId: string }> => {
    if (!mpRef.current) {
      throw new Error('MercadoPago SDK não carregado. Aguarde e tente novamente.');
    }

    const response = await mpRef.current.createCardToken({
      cardNumber: cardData.cardNumber.replace(/\s/g, ''),
      cardholderName: cardData.cardholderName,
      cardExpirationMonth: cardData.cardExpirationMonth,
      cardExpirationYear: cardData.cardExpirationYear,
      securityCode: cardData.securityCode,
      identificationType: cardData.identificationType,
      identificationNumber: cardData.identificationNumber,
    });

    if (response.error) {
      const causes = response.cause?.map((c: any) => c.description).join(', ');
      throw new Error(causes || response.error || 'Erro ao tokenizar cartão');
    }
    if (!response.id) {
      throw new Error('Token do cartão não gerado');
    }

    return { token: response.id, paymentMethodId: response.payment_method_id ?? '' };
  };

  return { tokenizeCard, isReady: () => !!mpRef.current };
}
