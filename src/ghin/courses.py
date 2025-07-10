import warnings
from enum import Enum

from rich import print
from rich.table import Table

from ghin.ghin import GHIN


class HoleCount(Enum):
    TOTAL = "Total"
    FRONT = "Front"
    BACK = "Back"


class Course(GHIN):
    def __init__(self, course_id: str, ghin_number: str = None):
        self.course_id = course_id
        self.ghin_number = ghin_number
        if self.ghin_number is None:
            warnings.warn(
                "No ghin number provided, you will need GHIN to use .get_course_handicaps() method"
            )

    def get_course_details(self, course_id: str = None, table: bool = False) -> dict:
        """Get the course details for a given course id"""
        if course_id is None:
            course_id = self.course_id
        url = f"https://api2.ghin.com/api/v1/crsCourseMethods.asmx/GetCourseDetails.json?courseId={course_id}&include_altered_tees=false&source=GHINcom"
        response = self._make_request(url)
        if table:
            self.format_course_details_table(response)
        return response

    @staticmethod
    def get_par_hole_counts(
        course_hole_list: list,
        rating_type: HoleCount,
    ) -> tuple:
        """Get the par and hole counts for a given course"""
        par_3s = 0
        par_4s = 0
        par_5s = 0
        longest_hole_yards = 0
        shortest_hole_yards = 999
        if rating_type == HoleCount.TOTAL:
            start_hole = 0
            end_hole = 18
        elif rating_type == HoleCount.FRONT:
            start_hole = 0
            end_hole = 9
        elif rating_type == HoleCount.BACK:
            start_hole = 9
            end_hole = 18
        for hole in course_hole_list[start_hole:end_hole]:
            if hole["Par"] == 3:
                par_3s += 1
            elif hole["Par"] == 4:
                par_4s += 1
            elif hole["Par"] == 5:
                par_5s += 1
            if hole["Length"] > longest_hole_yards:
                longest_hole_yards = hole["Length"]
            if hole["Length"] < shortest_hole_yards:
                shortest_hole_yards = hole["Length"]
        return par_3s, par_4s, par_5s, longest_hole_yards, shortest_hole_yards

    def format_course_details_table(self, course_details: dict) -> dict:
        """Format the course details into a dictionary"""
        course_details_table = Table(
            title=f"Course Details for {course_details['Facility']['FacilityName']}"
        )
        course_details_table.add_column("Tee", style="bold")
        course_details_table.add_column("Gender", style="bold")
        course_details_table.add_column("RatingType", style="bold")
        course_details_table.add_column("Rating", style="bold")
        course_details_table.add_column("SlopeRating", style="bold")
        course_details_table.add_column("BogeyRating", style="bold")
        course_details_table.add_column("Yardage", style="bold")
        course_details_table.add_column("Par", style="bold")
        course_details_table.add_column("Par3s", style="bold")
        course_details_table.add_column("Par4s", style="bold")
        course_details_table.add_column("Par5s", style="bold")
        course_details_table.add_column("Longest Hole Yds", style="bold")
        course_details_table.add_column("Shortest Hole Yds", style="bold")

        for tee in course_details["TeeSets"]:
            for rating in tee["Ratings"]:
                par_3s, par_4s, par_5s, longest_hole_yards, shortest_hole_yards = (
                    self.get_par_hole_counts(
                        tee["Holes"], HoleCount(rating["RatingType"])
                    )
                )
                course_details_table.add_row(
                    f"[{tee['TeeSetRatingName'].lower()}]{tee['TeeSetRatingName']}",
                    str(tee["Gender"]),
                    str(rating["RatingType"]),
                    str(rating["CourseRating"]),
                    str(rating["SlopeRating"]),
                    str(rating["BogeyRating"]),
                    str(tee["TotalYardage"]),
                    str(tee["TotalPar"]),
                    str(par_3s),
                    str(par_4s),
                    str(par_5s),
                    str(longest_hole_yards),
                    str(shortest_hole_yards),
                )
        print(course_details_table)

    def get_course_handicaps(
        self, ghin_number: str = None, course_id: str = None, table: bool = False
    ) -> dict:
        if course_id is None:
            course_id = self.course_id
        ghin = ghin_number or self.ghin_number
        if ghin is None:
            raise ValueError("No ghin number provided")
        url = f"https://api2.ghin.com/api/v1/course_handicaps.json?course_id={course_id}&golfer_id={ghin}&played_at=2025-07-01&source=GHINcom"
        response = self._make_request(url)

        if table:
            self.format_course_handicaps_table(response, ghin_number)

        return response

    @staticmethod
    def format_course_handicaps_table(course_handicaps: dict, ghin_number: str) -> dict:
        """Format the course handicaps into a dictionary"""
        handicap_table = Table(title=f"Course Handicaps for {ghin_number}")
        handicap_table.add_column("Tee", style="bold")
        handicap_table.add_column("Side", style="bold")
        handicap_table.add_column("Gender", style="bold")
        handicap_table.add_column("Rating", style="bold")
        handicap_table.add_column("Slope", style="bold")
        handicap_table.add_column("Par", style="bold")
        handicap_table.add_column("Course Handicap", style="bold")

        for tee in course_handicaps["tee_sets"]:
            for rating in tee["ratings"]:
                handicap_table.add_row(
                    str(tee["name"]),
                    str(rating["tee_set_side"]),
                    str(tee["gender"]),
                    str(rating["course_rating"]),
                    str(rating["slope_rating"]),
                    str(rating["par"]),
                    str(rating["course_handicap_display"]),
                )

        print(handicap_table)
