import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Course } from '../../types/course';

export interface CourseState {
  courses: Course[];
  currentCourse: Course | null;
  loading: boolean;
  error: string | null;
}

const initialState: CourseState = {
  courses: [],
  currentCourse: null,
  loading: false,
  error: null,
};

const courseSlice = createSlice({
  name: 'course',
  initialState,
  reducers: {
    // Course loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },

    // Course management
    setCourses: (state, action: PayloadAction<Course[]>) => {
      state.courses = action.payload;
      state.loading = false;
      state.error = null;
    },

    addCourse: (state, action: PayloadAction<Course>) => {
      state.courses.push(action.payload);
    },

    updateCourse: (state, action: PayloadAction<Course>) => {
      const index = state.courses.findIndex(course => course.name === action.payload.name);
      if (index !== -1) {
        state.courses[index] = action.payload;
      }
      if (state.currentCourse && state.currentCourse.name === action.payload.name) {
        state.currentCourse = action.payload;
      }
    },

    removeCourse: (state, action: PayloadAction<string>) => {
      state.courses = state.courses.filter(course => course.name !== action.payload);
      if (state.currentCourse && state.currentCourse.name === action.payload) {
        state.currentCourse = null;
      }
    },

    // Current course management
    setCurrentCourse: (state, action: PayloadAction<Course | null>) => {
      state.currentCourse = action.payload;
    },

    // Reset state
    resetCourseState: (state) => {
      state.courses = [];
      state.currentCourse = null;
      state.loading = false;
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setCourses,
  addCourse,
  updateCourse,
  removeCourse,
  setCurrentCourse,
  resetCourseState,
} = courseSlice.actions;

export default courseSlice.reducer;