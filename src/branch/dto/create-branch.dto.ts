export class CreateBranchDto {
  name: string;
  location: string;
  phone?: string;
  Open?: boolean;
  branch_manager_id?: string;
  email?: string;
  open_time?: string;
  close_time?: string;
}