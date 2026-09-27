/** Shows a success or error message in the Reports page's message bar. */
export type Notify = (type: 'success' | 'error', text: string) => void;

/** First day of the current month and today, as YYYY-MM-DD. */
export const currentMonthRange = () => {
  const now = new Date();
  const iso = (d: Date) => d.toLocaleDateString('en-CA');
  return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: iso(now) };
};
