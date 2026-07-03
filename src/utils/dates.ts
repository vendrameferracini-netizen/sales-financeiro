export const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayISO = () => toISODate(new Date());

export const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

export const formatDate = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

export const monthKey = (iso: string) => iso.slice(0, 7);

export const monthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
};

export const getWeekRange = (iso: string) => {
  const date = new Date(`${iso}T12:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toISODate(start), end: toISODate(end), label: `${formatDate(toISODate(start))} a ${formatDate(toISODate(end))}` };
};

export const getFortnightRange = (month: string, fortnight: "first" | "second") => {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const startDay = fortnight === "first" ? 1 : 16;
  const endDay = fortnight === "first" ? 15 : lastDay;
  const start = `${month}-${String(startDay).padStart(2, "0")}`;
  const end = `${month}-${String(endDay).padStart(2, "0")}`;
  return { start, end, label: `${fortnight === "first" ? "1a quinzena" : "2a quinzena"} - ${formatDate(start)} a ${formatDate(end)}` };
};

export const getMonthRange = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const start = `${month}-01`;
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, label: monthLabel(month) };
};

export const daysBetween = (start: string, end: string) => {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
};
