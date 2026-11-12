import sys
import unittest
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services import attendance_rules as r  # noqa: E402

UTC = timezone.utc
SAT = date(2026, 10, 24)
SUN = date(2026, 10, 25)
MON = date(2026, 10, 26)
TUE = date(2026, 10, 27)
WED = date(2026, 10, 28)
P = r.DEFAULT_POLICY   # 09:00-17:00, 30/30 grace, 8h full, 4h half, OT from 30 min, 12h cutoff
HISTORY = [(date(2000, 1, 1), P)]
LONG_AFTER = datetime(2026, 11, 20, 12, 0, tzinfo=UTC)   # a "now" far after the days we judge


def ist(h, m=0, day=MON, s=0):
    """A moment typed in India time."""
    return datetime(day.year, day.month, day.day, h, m, s, tzinfo=r.IST)


def judge(ci, co, ctype=None, now=LONG_AFTER, policy=P):
    return r.evaluate_record(ci, co, ctype, now, policy)


class StartAndEnd(unittest.TestCase):
    def test_full_day_on_time(self):
        x = judge(ist(9, 0), ist(17, 0))
        self.assertEqual((x["status"], x["minutes"], x["overtime"]), (r.PRESENT, 480, 0))
        self.assertFalse(x["late"] or x["early"])

    def test_early_arrival_earns_nothing(self):
        x = judge(ist(8, 0), ist(17, 0))
        self.assertEqual(x["minutes"], 480)

    def test_arrival_inside_grace_counts_from_shift_start(self):
        x = judge(ist(9, 30), ist(17, 0))
        self.assertEqual((x["minutes"], x["late"]), (480, False))

    def test_arrival_after_grace_is_late_and_counts_real_time(self):
        x = judge(ist(9, 31), ist(17, 0))
        self.assertTrue(x["late"])
        self.assertEqual(x["minutes"], 449)   # 7h29

    def test_the_cliff_0945_to_1700_is_a_half_day(self):
        x = judge(ist(9, 45), ist(17, 0))
        self.assertEqual((x["minutes"], x["status"], x["late"]), (435, r.HALF_DAY, True))

    def test_noon_to_five_is_a_late_half_day(self):
        x = judge(ist(12, 0), ist(17, 0))
        self.assertEqual((x["minutes"], x["status"], x["late"]), (300, r.HALF_DAY, True))

    def test_noon_to_2030_is_a_late_full_day_with_overtime(self):
        x = judge(ist(12, 0), ist(20, 30))
        self.assertEqual((x["minutes"], x["status"], x["overtime"], x["late"]),
                         (510, r.PRESENT, 30, True))

    def test_leaving_inside_the_last_30_minutes_counts_to_shift_end(self):
        x = judge(ist(9, 0), ist(16, 30))
        self.assertEqual((x["minutes"], x["early"], x["status"]), (480, False, r.PRESENT))
        x = judge(ist(9, 0), ist(16, 40))
        self.assertEqual((x["minutes"], x["early"]), (480, False))

    def test_leaving_earlier_counts_real_time_and_flags_early_leave(self):
        x = judge(ist(9, 0), ist(16, 29))
        self.assertEqual((x["minutes"], x["early"], x["status"]), (449, True, r.HALF_DAY))

    def test_hr_flow_table(self):
        # forgot to check out, HR enters the real time
        a = judge(ist(9, 0), ist(17, 30), "MISSED_CHECKOUT")
        self.assertEqual((a["minutes"], a["status"], a["overtime"]), (510, r.PRESENT, 30))
        b = judge(ist(9, 0), ist(13, 0), "MISSED_CHECKOUT")
        self.assertEqual((b["minutes"], b["status"]), (240, r.HALF_DAY))
        c = judge(ist(9, 0), ist(12, 0), "MISSED_CHECKOUT")
        self.assertEqual((c["minutes"], c["status"]), (180, r.ABSENT))


class Overtime(unittest.TestCase):
    def test_under_30_minutes_is_not_shown(self):
        x = judge(ist(9, 0), ist(17, 20))
        self.assertEqual((x["minutes"], x["overtime"]), (500, 0))

    def test_exactly_30_minutes_is_shown(self):
        self.assertEqual(judge(ist(9, 0), ist(17, 30))["overtime"], 30)

    def test_long_day(self):
        self.assertEqual(judge(ist(9, 0), ist(19, 15))["overtime"], 135)

    def test_early_arrival_does_not_make_overtime(self):
        self.assertEqual(judge(ist(7, 0), ist(17, 0))["overtime"], 0)

    def test_grace_credit_does_not_inflate_overtime(self):
        x = judge(ist(9, 30), ist(17, 30))
        self.assertEqual((x["minutes"], x["overtime"]), (510, 0))


class MissedCheckout(unittest.TestCase):
    def test_open_within_cutoff_is_active(self):
        x = judge(ist(9, 0), None, now=ist(21, 0))            # 12h exactly
        self.assertEqual(x["status"], r.ACTIVE)
        self.assertIsNone(x["minutes"])

    def test_open_past_cutoff_is_incomplete_with_no_assumed_hours(self):
        x = judge(ist(9, 0), None, now=ist(21, 1))
        self.assertEqual((x["status"], x["minutes"], x["overtime"], x["missed"]),
                         (r.INCOMPLETE, None, 0, True))

    def test_open_is_judged_by_elapsed_time_not_the_calendar_date(self):
        # checked in 22:00 Monday, it is 01:00 Tuesday: still working, not missed
        x = judge(ist(22, 0), None, now=ist(1, 0, day=TUE))
        self.assertEqual(x["status"], r.ACTIVE)

    def test_checkout_beyond_cutoff_without_hr_correction_is_incomplete(self):
        x = judge(ist(9, 0), ist(21, 30))
        self.assertEqual((x["status"], x["minutes"], x["overtime"], x["missed"]),
                         (r.INCOMPLETE, None, 0, True))

    def test_hr_entered_time_is_trusted_even_past_12_hours(self):
        x = judge(ist(9, 0), ist(22, 0), "WRONG_TIME")
        self.assertFalse(x["missed"])
        self.assertEqual(x["minutes"], 780)

    def test_open_row_stays_incomplete_even_with_a_correction_type(self):
        x = judge(ist(9, 0), None, "WRONG_TIME", now=LONG_AFTER)
        self.assertTrue(x["missed"])


class DayCell(unittest.TestCase):
    def cell(self, day, ci=None, co=None, ctype=None, now=LONG_AFTER, today=None):
        return r.build_day_cell(day, today or date(2026, 11, 20), now, ci, co, ctype, HISTORY)

    def test_no_record(self):
        self.assertEqual(self.cell(SAT)["status"], r.WEEKEND)
        self.assertEqual(self.cell(MON)["status"], r.ABSENT)
        self.assertEqual(self.cell(MON, today=MON)["status"], r.YET_TO_CHECK_IN)
        self.assertIsNone(self.cell(WED, today=MON)["status"])          # future

    def test_work_on_an_off_day_is_a_normal_record(self):
        x = self.cell(SAT, ist(9, 0, day=SAT), ist(17, 0, day=SAT))
        self.assertEqual((x["status"], x["worked_minutes"]), (r.PRESENT, 480))

    def test_flags(self):
        x = self.cell(MON, ist(10, 0), ist(16, 0))
        self.assertEqual(x["flags"], [r.LATE, r.EARLY_LEAVE])
        self.assertEqual(self.cell(MON, ist(9, 0), ist(17, 0))["flags"], [])

    def test_incomplete_status_clears_after_hr_correction(self):
        pending = self.cell(MON, ist(9, 0), None)
        self.assertEqual(pending["flags"], [r.MISSED_CHECKOUT])
        self.assertTrue(pending["missed_checkout_pending"])
        fixed = self.cell(MON, ist(9, 0), ist(17, 30), "MISSED_CHECKOUT")
        self.assertEqual(fixed["flags"], [])
        self.assertFalse(fixed["missed_checkout_pending"])
        self.assertEqual(fixed["overtime_minutes"], 30)

    def test_wrong_time_is_not_counted_as_missed(self):
        x = self.cell(MON, ist(9, 0), ist(17, 0), "WRONG_TIME")
        self.assertEqual(x["flags"], [])

    def test_blank_cell_shape(self):
        x = self.cell(WED, today=MON)
        self.assertEqual((x["flags"], x["overtime_minutes"], x["worked_minutes"]), ([], 0, None))


class PolicyHistory(unittest.TestCase):
    OLD = P
    NEW = r.Policy("Strict", time(10, 0), time(18, 0), 10, 10, 9.0, 5.0, 15, 3.0, (6,))
    HISTORY = [(date(2000, 1, 1), OLD), (date(2026, 11, 1), NEW)]

    def test_each_day_uses_the_policy_in_force(self):
        self.assertEqual(r.policy_for(date(2026, 10, 31), self.HISTORY), self.OLD)
        self.assertEqual(r.policy_for(date(2026, 11, 1), self.HISTORY), self.NEW)
        self.assertEqual(r.policy_for(date(1999, 1, 1), self.HISTORY), self.OLD)
        self.assertEqual(r.policy_for(MON, []), r.DEFAULT_POLICY)

    def test_old_day_keeps_old_status_after_a_stricter_policy(self):
        day = date(2026, 10, 30)
        cell = r.build_day_cell(day, date(2026, 11, 5), LONG_AFTER,
                                ist(9, 0, day=day), ist(17, 0, day=day), None, self.HISTORY)
        self.assertEqual(cell["status"], r.PRESENT)
        # the same hours on a new-policy day (9h full day needed) are only a half day
        day = date(2026, 11, 2)
        cell = r.build_day_cell(day, date(2026, 11, 5), LONG_AFTER,
                                ist(10, 0, day=day), ist(18, 0, day=day), None, self.HISTORY)
        self.assertEqual(cell["status"], r.HALF_DAY)

    def test_cutoff_follows_the_policy(self):
        self.assertEqual(P.cutoff_minutes, 720)
        self.assertEqual(self.NEW.cutoff_minutes, 720)   # 9 + 3

    def test_validation(self):
        ok = (time(9, 0), time(17, 0), 30, 30, 8, 4, 30, 4, [5, 6])
        r.validate_policy_values(*ok)
        bad = [
            (time(17, 0), time(9, 0), 30, 30, 8, 4, 30, 4, [5, 6]),     # end before start
            (time(9, 0), time(17, 0), -1, 30, 8, 4, 30, 4, [5, 6]),
            (time(9, 0), time(17, 0), 30, 181, 8, 4, 30, 4, [5, 6]),
            (time(9, 0), time(10, 0), 40, 30, 8, 4, 30, 4, [5, 6]),     # graces fill the shift
            (time(9, 0), time(17, 0), 30, 30, 25, 4, 30, 4, [5, 6]),
            (time(9, 0), time(17, 0), 30, 30, 8, 8, 30, 4, [5, 6]),     # half == full
            (time(9, 0), time(17, 0), 30, 30, 8, 4, 241, 4, [5, 6]),
            (time(9, 0), time(17, 0), 30, 30, 8, 4, 30, -1, [5, 6]),
            (time(9, 0), time(17, 0), 30, 30, 20, 4, 30, 5, [5, 6]),    # 20 + 5 > 24
            (time(9, 0), time(17, 0), 30, 30, 8, 4, 30, 4, [7]),
            (time(9, 0), time(17, 0), 30, 30, 8, 4, 30, 4, [0, 1, 2, 3, 4, 5, 6]),
        ]
        for values in bad:
            with self.assertRaises(ValueError, msg=str(values)):
                r.validate_policy_values(*values)

    def test_a_policy_starts_tomorrow_or_later(self):
        r.validate_policy_start(WED, TUE)
        for bad in (TUE, MON):
            with self.assertRaises(ValueError):
                r.validate_policy_start(bad, TUE)


class Dates(unittest.TestCase):
    def test_ist_date_rolls_over_at_1830_utc(self):
        self.assertEqual(r.ist_date(datetime(2026, 10, 26, 18, 29, tzinfo=UTC)), MON)
        self.assertEqual(r.ist_date(datetime(2026, 10, 26, 18, 30, tzinfo=UTC)), TUE)

    def test_naive_datetime_is_treated_as_utc(self):
        self.assertEqual(r.ist_date(datetime(2026, 10, 26, 18, 30)), TUE)

    def test_from_local_treats_naive_as_india_time(self):
        self.assertEqual(r.from_local(datetime(2026, 10, 26, 9, 30)),
                         datetime(2026, 10, 26, 4, 0, tzinfo=UTC))


class Banner(unittest.TestCase):
    JOIN = date(2026, 1, 5)

    def state(self, today=MON, joining=None, rec=False, out=False, open_=False):
        return r.banner_state(today, joining or self.JOIN, rec, out, open_, P)

    def test_states(self):
        self.assertEqual(self.state(), r.NOT_CHECKED_IN)
        self.assertEqual(self.state(rec=True), r.CHECKED_IN)
        self.assertEqual(self.state(rec=True, out=True), r.CHECKED_OUT)
        self.assertEqual(self.state(today=SAT), r.NON_WORKING)
        self.assertEqual(self.state(joining=date(2026, 12, 1)), r.NON_WORKING)

    def test_a_session_open_from_last_night_shows_checked_in(self):
        self.assertEqual(self.state(open_=True), r.CHECKED_IN)


class Corrections(unittest.TestCase):
    NOW = datetime(2026, 10, 27, 12, 0, tzinfo=UTC)   # 17:30 IST on Tuesday 27 Oct
    JOIN = date(2026, 1, 5)

    def check(self, work_date=MON, ci=None, co=None, clear=False, ctype="MISSED_CHECKOUT"):
        r.validate_correction(work_date, self.JOIN, ci, co, clear, ctype, self.NOW)

    def fails(self, **kw):
        with self.assertRaises(ValueError):
            self.check(**kw)

    def test_valid_cases(self):
        self.check(ci=ist(9, 0), co=ist(17, 30))
        self.check(ci=ist(9, 0), co=None)                  # lunchtime tap: clear the check-out
        self.check(clear=True)

    def test_type_is_required_unless_clearing(self):
        self.fails(ci=ist(9, 0), ctype=None)
        self.fails(ci=ist(9, 0), ctype="OTHER")
        self.check(clear=True, ctype=None)

    def test_future_dates_are_blocked(self):
        self.fails(work_date=WED, ci=ist(9, 0, day=WED))

    def test_thirty_day_window(self):
        ok, old = date(2026, 9, 27), date(2026, 9, 26)
        self.check(work_date=ok, ci=ist(9, 0, day=ok))
        self.fails(work_date=old, ci=ist(9, 0, day=old))
        self.fails(work_date=old, clear=True)

    def test_before_joining_is_blocked(self):
        d = date(2026, 1, 2)
        with self.assertRaises(ValueError):
            r.validate_correction(d, self.JOIN, ist(9, 0, day=d), None, False,
                                  "MANUAL_ENTRY", datetime(2026, 1, 10, 12, 0, tzinfo=UTC))

    def test_checkout_rules(self):
        self.fails(ci=ist(18, 0), co=ist(9, 0))
        self.fails(ci=ist(9, 0), co=ist(9, 0))
        self.fails(ci=ist(1, 0, day=MON), co=ist(2, 0, day=TUE))     # more than 24h
        self.check(ci=ist(22, 0, day=MON), co=ist(6, 0, day=TUE))    # overnight is fine

    def test_checkin_must_be_on_the_chosen_day_and_in_the_past(self):
        self.fails(work_date=MON, ci=ist(9, 0, day=TUE))
        self.fails(work_date=TUE, ci=ist(18, 0, day=TUE))            # now is 17:30
        self.fails(work_date=TUE, ci=ist(9, 0, day=TUE), co=ist(18, 0, day=TUE))

    def test_missing_checkin_and_times_with_clear(self):
        self.fails(ci=None)


class Reasons(unittest.TestCase):
    def test_defaults_when_nothing_typed(self):
        self.assertEqual(
            r.resolve_reason(False, "MISSED_CHECKOUT", None),
            "Missed checkout corrected by HR",
        )
        self.assertEqual(
            r.resolve_reason(False, "WRONG_TIME", "  "),
            "Attendance time corrected by HR",
        )
        self.assertEqual(
            r.resolve_reason(False, "MANUAL_ENTRY", None),
            "Attendance entered by HR",
        )

    def test_clear_does_not_require_typed_reason(self):
        self.assertEqual(
            r.resolve_reason(True, None, None),
            "Attendance record cleared by HR",
        )

    def test_optional_typed_reason_is_preserved_without_minimum_length(self):
        self.assertEqual(r.resolve_reason(False, "MISSED_CHECKOUT", "Fix"), "Fix")


if __name__ == "__main__":
    unittest.main()