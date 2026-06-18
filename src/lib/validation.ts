export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidName(name: string, min = 2) {
  return name.trim().length >= min;
}

export function isValidDateRange(start: string, end: string) {
  if (!start || !end) return false;
  return new Date(start) <= new Date(end);
}

export function isPositiveNumber(value: string, optional = true) {
  if (!value.trim()) return optional;
  const n = Number(value);
  return !Number.isNaN(n) && n > 0;
}
