function createSlaError(message) {
  const error = new Error(message);
  error.code = "INVALID_SLA_INPUT";
  return error;
}

function parseBusinessTime(value) {
  const parts = String(value || "").split(":");
  if (parts.length !== 2) {
    throw createSlaError("Invalid business hour format");
  }
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw createSlaError("Invalid business hour value");
  }
  return { hour, minute };
}

function getLocalDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  return {
    weekday: map.weekday,
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function weekdayToKey(weekdayShort) {
  const map = {
    Mon: "monday",
    Tue: "tuesday",
    Wed: "wednesday",
    Thu: "thursday",
    Fri: "friday",
    Sat: "saturday",
    Sun: "sunday",
  };
  return map[weekdayShort] || null;
}

function isWithinBusinessWindow(date, timeZone, businessHours) {
  const local = getLocalDateParts(date, timeZone);
  const dayKey = weekdayToKey(local.weekday);
  if (!dayKey) {
    return false;
  }

  const dayWindow = businessHours[dayKey];
  if (!dayWindow) {
    return false;
  }

  const start = parseBusinessTime(dayWindow.start);
  const end = parseBusinessTime(dayWindow.end);
  const minuteOfDay = local.hour * 60 + local.minute;
  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;

  return minuteOfDay >= startMinute && minuteOfDay < endMinute;
}

function nextBusinessMinute(date, timeZone, businessHours) {
  let cursor = new Date(date);
  for (let i = 0; i < 60 * 24 * 14; i += 1) {
    if (isWithinBusinessWindow(cursor, timeZone, businessHours)) {
      return cursor;
    }
    cursor = new Date(cursor.getTime() + 60 * 1000);
  }
  throw createSlaError("Unable to find next business minute");
}

function addBusinessMinutes(startDate, minutesToAdd, timeZone, businessHours) {
  if (!Number.isInteger(minutesToAdd) || minutesToAdd < 0) {
    throw createSlaError("minutesToAdd must be a non-negative integer");
  }

  let cursor = nextBusinessMinute(startDate, timeZone, businessHours);
  let remaining = minutesToAdd;

  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 60 * 1000);
    if (isWithinBusinessWindow(cursor, timeZone, businessHours)) {
      remaining -= 1;
    }
  }

  return cursor;
}

function computeSlaDeadlines({
  createdAt,
  timeZone,
  businessHours,
  firstResponseMinutes,
  resolutionMinutes,
}) {
  const firstResponseDueAt = addBusinessMinutes(createdAt, firstResponseMinutes, timeZone, businessHours);
  const resolutionDueAt = addBusinessMinutes(createdAt, resolutionMinutes, timeZone, businessHours);
  return {
    firstResponseDueAt,
    resolutionDueAt,
  };
}

module.exports = {
  addBusinessMinutes,
  computeSlaDeadlines,
};
