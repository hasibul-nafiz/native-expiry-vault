/**
 * Recognised-text fixtures.
 *
 * These are what `TextRecognition.recognize()` gives back — plain text with
 * the line breaks ML Kit found — not images. Text is what the parsers consume,
 * it is reviewable in a diff, and it keeps the suite free of a native module.
 *
 * The MRZ check digits here are real, computed with the ICAO 7-3-1 weighting.
 * A fixture with a wrong digit would make `verified` assertions meaningless.
 */

/** UK passport photo page: printed fields plus a TD3 zone. Expires 2030-10-28. */
export const UK_PASSPORT = `PASSPORT
UNITED KINGDOM OF GREAT BRITAIN
Type / Code / Passport No.
P GBR P4920191
Surname SMITH
Given names JOHN ROBERT
Nationality BRITISH CITIZEN
Date of birth 01 JAN 1985
Date of issue 28 OCT 2020
Date of expiry 28 OCT 2030
Authority HMPO
P<GBRSMITH<<JOHN<ROBERT<<<<<<<<<<<<<<<<<<<<<
P4920191<7GBR8501019M3010286<<<<<<<<<<<<<<02`;

/** German ID card: a three-line TD1 zone. Expires 2027-10-31. */
export const GERMAN_ID = `BUNDESREPUBLIK DEUTSCHLAND
PERSONALAUSWEIS
Name MUSTERMANN
Vorname ERIKA
Geburtsdatum 12.08.1964
Gultig bis 31.10.2027
IDDEUT220001293<<<<<<<<<<<<<<<
6408125F2710316DEU<<<<<<<<<<<4
MUSTERMANN<<ERIKA<<<<<<<<<<<<<`;

/** French residence permit: a two-line TD2 zone. Expires 2029-05-12. */
export const FRENCH_PERMIT = `REPUBLIQUE FRANCAISE
TITRE DE SEJOUR
Nom ERIKSSON
Prenoms ANNA MARIA
Date de delivrance 12/05/2024
Valable jusqu'au 12/05/2029
I<FRAERIKSSON<<ANNA<MARIA<<<<<<<<<<<
D231458907FRA7408122F2905121<<<<<<<0`;

/**
 * The same UK passport with the classic OCR confusion: the `0` in the expiry
 * group read as an `O`. The field still yields a date; its check digit does
 * not pass, which is the whole point of computing one.
 */
export const UK_PASSPORT_MISREAD = `P<GBRSMITH<<JOHN<ROBERT<<<<<<<<<<<<<<<<<<<<<
P4920191<7GBR8501019M3O10286<<<<<<<<<<<<<<02`;

/** A US insurance card: month-day-year, no MRZ. */
export const US_INSURANCE_CARD = `BLUE RIDGE HEALTH
Member ID  XZ-4471-99
Group 40218
Effective 03/15/2026
Expiration Date 09/30/2027
Customer Service 1-800-555-0142`;

/**
 * A warranty receipt with an ambiguous numeric date and nothing to
 * disambiguate it: 04/03/2029 is 4 March or 3 April depending on the country
 * the shop is in, and the receipt does not say.
 */
export const WARRANTY_RECEIPT = `NORDIC ELECTRONICS
Order 88-2213
Item  Espresso machine
Purchased 04/03/2027
Warranty valid until 04/03/2029
Keep this receipt`;

/** Nothing date-like at all: a blurred or badly aimed frame. */
export const NO_DATE = `NORDIC ELECTRONICS
Thank you for your purchase
Store 118`;
