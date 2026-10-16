export interface EmployeeDetail {
  employee_id: number;
  employee_code: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  dob: string | null;
  date_of_joining: string;
  employment_type: string;
  status: string;
  role_id: number | null;
  role_name: string | null;
  department_id: number | null;
  department_name: string | null;
  designation_id: number | null;
  designation_name: string | null;
  manager_id: number | null;
  manager_name: string | null;
  profile_completed: boolean;
  is_active: boolean;
  last_login: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
}

export interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  total_departments: number;
  profile_incomplete?: number;
}

export interface LookupItem {
  id: number;
  name: string;
}

export interface EmployeeLookups {
  roles: LookupItem[];
  departments: LookupItem[];
  designations: LookupItem[];
  managers: LookupItem[];
}

export interface EmployeeProfile {
  employee_code: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_name: string | null;
  department_name: string | null;
  designation_name: string | null;
  manager_name: string | null;
  phone: string | null;
  dob: string | null;
  date_of_joining: string;
  employment_type: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
}

export interface PasswordResetResponse {
  message: string;
  email_sent: boolean;
}

export interface StatusChangeResponse extends EmployeeDetail {
  message?: string | null;
}
