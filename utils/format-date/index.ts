export const formatCustomDate = (input: string | number) => {
  let date: Date;

  if (typeof input === "number" || /^\d+$/.test(input.toString().trim())) {
    // If input is a number or string with only digits (Unix timestamp)
    const timestamp = Number(input) * 1000; // Convert seconds to milliseconds
    date = new Date(timestamp);
  } else {
    const [datePart] = input.toString().split(",");
    date = new Date(datePart.trim());
  }

  if (isNaN(date.getTime())) {
    throw new Error("Invalid date input");
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};
