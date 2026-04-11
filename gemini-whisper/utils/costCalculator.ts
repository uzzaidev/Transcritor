
export const OPENAI_WHISPER_PRICE_PER_MINUTE = 0.006;

/**
 * Calculates the estimated cost for transcribing an audio file using OpenAI Whisper.
 * @param durationInSeconds The duration of the audio in seconds.
 * @returns The estimated cost in USD.
 */
export const calculateOpenAICost = (durationInSeconds: number): number => {
    const durationInMinutes = durationInSeconds / 60;
    // OpenAI rounds up to the nearest second for billing, but for estimation, minutes is fine.
    // Actually, they likely bill per second or similar unit, but price is quoted per minute.
    // Let's keep it simple: price * minutes.
    return durationInMinutes * OPENAI_WHISPER_PRICE_PER_MINUTE;
};

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
    }).format(amount);
};
