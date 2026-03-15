// types/job.ts
// ── Unified 5-step job lifecycle ──────────────────────────────────────────────
// Staff sees:    Assigned → In Progress → Completed → Quality Check → Finished
// Customer sees: Confirmed  Being Washed  Wash Completed  QC  Ready for Pickup

export type JobStatus =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'quality_check'
  | 'finished';

// ── Customer-facing display ───────────────────────────────────────────────────
export interface JobStep {
  status: JobStatus;
  label:  string; // customer label
  icon:   string; // Ionicons name
}

export const JOB_STEPS: JobStep[] = [
  { status: 'assigned',      label: 'Booking Confirmed',    icon: 'checkmark-circle'  },
  { status: 'in_progress',   label: 'Vehicle Being Washed', icon: 'water'             },
  { status: 'completed',     label: 'Wash Completed',       icon: 'sparkles'          },
  { status: 'quality_check', label: 'Quality Check',        icon: 'search-circle'     },
  { status: 'finished',      label: 'Ready for Pickup',     icon: 'car'               },
];

// Customer-facing labels (used in push notifications and customer track screen)
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  assigned:      'Booking Confirmed',
  in_progress:   'Vehicle Being Washed',
  completed:     'Wash Completed',
  quality_check: 'Quality Check',
  finished:      'Ready for Pickup',
};

// ── Staff-facing display ─────────────────────────────────────────────────────
export const STAFF_STATUS_LABELS: Record<JobStatus, string> = {
  assigned:      'Assigned',
  in_progress:   'In Progress',
  completed:     'Completed',
  quality_check: 'Quality Check',
  finished:      'Finished',
};

export const STAFF_STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  assigned:      { bg: '#e8f4fd', text: '#0077cc' },
  in_progress:   { bg: '#fff3e0', text: '#e65100' },
  completed:     { bg: '#e0f2f1', text: '#00695c' },
  quality_check: { bg: '#f3eafd', text: '#6a0dad' },
  finished:      { bg: '#e8f5e9', text: '#2e7d32' },
};

// Next status in the advance chain (undefined = terminal)
export const NEXT_JOB_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  assigned:      'in_progress',
  in_progress:   'completed',
  completed:     'quality_check',
  quality_check: 'finished',
};

export const ADVANCE_BUTTON_LABELS: Partial<Record<JobStatus, string>> = {
  assigned:      'Start Job',
  in_progress:   'Mark Completed',
  completed:     'Send to QC',
  quality_check: 'Mark Finished',
};

// ── Data shape returned by GET /api/jobs/:id ─────────────────────────────────
export interface JobTracking {
  _id:             string;
  jobStatus:       JobStatus;
  assignedStaffId: string | null;
  technicianName:  string;
  technicianLat:   number | null;
  technicianLng:   number | null;
  staffNotes:      string;
  photos:          JobPhoto[];
  serviceLabel:    string;
  vehicleLabel:    string;
  locationType:    'bay' | 'mobile';
  bayLabel:        string;
  bayAddress:      string;
  mobileAddress:   string;
  mobileLat:       number | null;
  mobileLng:       number | null;
  appointmentDate: string;
  appointmentTime: string;
  totalPrice:      number;
  durationMinutes: number;
  status:          string;
}

export interface JobPhoto {
  _id:     string;
  label:   'before' | 'after';
  data:    string; // base64 data URL
  staffId: string;
  takenAt: string;
}

// ── Summary shape for the job list (GET /api/jobs) ───────────────────────────
export interface JobSummary {
  _id:             string;
  serviceLabel:    string;
  vehicleLabel:    string;
  appointmentTime: string;
  locationType:    'bay' | 'mobile';
  bayLabel:        string;
  mobileAddress:   string;
  jobStatus:       JobStatus;
  assignedStaffId: string | null;
  technicianName:  string;
  totalPrice:      number;
  durationMinutes: number;
}
