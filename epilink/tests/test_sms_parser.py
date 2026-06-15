from datetime import date

import pytest

from services.sms_parser import parse_sms


class TestSmsParser:
    def test_valid_sms(self):
        result = parse_sms("RPT#EGY042#A39.0#15-29#M#ALIVE")
        assert result["facility_id"] == "EGY042"
        assert result["icd10_code"] == "A39.0"
        assert result["age_group"] == "15-29"
        assert result["sex"] == "M"
        assert result["outcome"] == "Alive"
        assert result["submission_mode"] == "sms-fallback"
        assert result["diagnosis_basis"] == "Clinical"
        assert result["hospitalized"] is False
        assert result["lab_sample_taken"] is False
        assert result["district"] == "Unknown"
        assert result["physician_id"] == "SMS-EGY042-AUTO"
        assert result["symptom_onset_date"] == date.today()

    def test_valid_sms_dead_outcome(self):
        result = parse_sms("RPT#EGY001#A00.1#5-14#F#DEAD")
        assert result["outcome"] == "Dead"

    def test_valid_sms_unknown_outcome(self):
        result = parse_sms("RPT#EGY002#B26#60+#M#UNK")
        assert result["outcome"] == "Unknown"

    def test_invalid_format_wrong_length(self):
        with pytest.raises(ValueError, match="expected 6 fields"):
            parse_sms("RPT#EGY042#A39.0")

    def test_invalid_format_wrong_prefix(self):
        with pytest.raises(ValueError, match="expected first field 'RPT'"):
            parse_sms("ABC#EGY042#A39.0#15-29#M#ALIVE")

    def test_invalid_sex(self):
        with pytest.raises(ValueError, match="Invalid sex"):
            parse_sms("RPT#EGY042#A39.0#15-29#X#ALIVE")

    def test_invalid_outcome(self):
        with pytest.raises(ValueError, match="Invalid outcome"):
            parse_sms("RPT#EGY042#A39.0#15-29#M#UNKNOWN")

    def test_invalid_age_group(self):
        with pytest.raises(ValueError, match="Invalid age_group"):
            parse_sms("RPT#EGY042#A39.0#0-99#M#ALIVE")

    def test_empty_body(self):
        with pytest.raises(ValueError, match="expected 6 fields"):
            parse_sms("")

    def test_whitespace_handling(self):
        result = parse_sms("  RPT#EGY042#A39.0#15-29#M#ALIVE  ")
        assert result["facility_id"] == "EGY042"
