export const sanitizePhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters
  const sanitized = phoneNumber.replace(/\D/g, "");

  // Check if the number starts with a country code (e.g., +233 for Ghana)
  if (sanitized.startsWith("0")) {
    // If it starts with 0, replace it with the country code
    return `+233${sanitized.slice(1)}`;
  }

  // If it doesn't start with a country code, assume it's already in the correct format
  return sanitized;
}