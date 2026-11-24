<script setup>
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
} from "reka-ui";
import { CalendarDate } from "@internationalized/date";

// Date in, Date out: the public contract of this wrapper is native JS Dates
// (local time), but reka's calendar runs on @internationalized/date values —
// a bare Date would crash CalendarRoot, which calls .copy() on it. Convert at
// both ends of the boundary and expose only Dates to consumers.
const props = defineProps({
  modelValue: { type: Date, default: null },
  min: { type: Date, default: null },
  max: { type: Date, default: null },
});
const emit = defineEmits(["update:modelValue"]);

const toValue = (d) =>
  d ? new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) : undefined;

// Dates leave at local midnight, the natural carrier of a calendar day.
function onPick(value) {
  emit("update:modelValue", value ? new Date(value.year, value.month - 1, value.day) : null);
}
</script>

<template>
  <CalendarRoot
    :model-value="toValue(props.modelValue)"
    :min-value="toValue(props.min)"
    :max-value="toValue(props.max)"
    locale="en-GB"
    :week-starts-on="1"
    prevent-deselect
    class="rc-cal"
    @update:model-value="onPick"
  >
    <!-- reka computes the month grid (rows of DateValues) and the weekday
         labels from the current placeholder; render-prop them from the root. -->
    <template #default="{ grid, weekDays }">
      <CalendarHeader class="rc-cal__header">
        <CalendarPrev class="rc-btn rc-btn--ghost rc-btn--sm rc-btn--icon" aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </CalendarPrev>
        <CalendarHeading class="rc-cal__heading" />
        <CalendarNext class="rc-btn rc-btn--ghost rc-btn--sm rc-btn--icon" aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </CalendarNext>
      </CalendarHeader>
      <CalendarGrid class="rc-cal__grid">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell v-for="(day, i) in weekDays" :key="i" class="rc-cal__weekday">
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(week, wi) in grid[0].rows" :key="wi">
            <CalendarCell v-for="day in week" :key="day.toString()" :date="day" class="rc-cal__cell">
              <CalendarCellTrigger :day="day" :month="grid[0].value" class="rc-cal__day" />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </template>
  </CalendarRoot>
</template>
