import { numberToWords, rupeesInWords } from './number-to-words.util';

describe('numberToWords (Indian system)', () => {
  it.each([
    [0, 'Zero'],
    [7, 'Seven'],
    [15, 'Fifteen'],
    [90, 'Ninety'],
    [305, 'Three Hundred Five'],
    [1000, 'One Thousand'],
    [26960000, 'Two Crore Sixty Nine Lakh Sixty Thousand'],
    [24264000, 'Two Crore Forty Two Lakh Sixty Four Thousand'],
    [2394000, 'Twenty Three Lakh Ninety Four Thousand'],
    [10188000, 'One Crore One Lakh Eighty Eight Thousand'],
  ])('%s -> %s', (input, expected) => {
    expect(numberToWords(input as number)).toBe(expected);
  });

  it('formats a rupee amount', () => {
    expect(rupeesInWords(21568000)).toBe(
      'Rupees Two Crore Fifteen Lakh Sixty Eight Thousand Only',
    );
  });
});
