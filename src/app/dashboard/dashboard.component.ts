// Core Angular imports
import { Component, OnInit } from '@angular/core';
// CommonModule provides ngIf/ngFor and other common directives used in templates
import { CommonModule } from '@angular/common';
// FormsModule is required for template-driven forms and [(ngModel)] bindings
import { FormsModule } from '@angular/forms';
// Application service to fetch user data (and later to post budgets)
import { UserService } from '../services/user.service';
// xlsx library to parse Excel files when users bulk-upload budgets
import * as XLSX from 'xlsx';
//swal for alert dialog box
import Swal from 'sweetalert2';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent implements OnInit {
  users: any[] = [];
  errorMessage = '';
  loggedUserName: string = '';

  // Budget UI State
  // Controls visibility of the Add Budget modal
  showBudgetForm = false;
  // Shape used for a single manual budget row before adding to the editable list
  manualBudget: { code: String; item: string; amount: number | null; description: string } = {
    code: '',
    item: '',
    amount: null,
    description: ''
  };

  // A single, session-level budget name. For bulk uploads this defaults to the file name
  budgetName: string = '';
  // Additional session-level metadata the user can set in the modal
  category: string = '';
  date: string = '';
  department: string = '';
  // Editable list that contains items from manual add or parsed from Excel
  bulkBudgets: any[] = [];
  // Pagination state: show N rows per page and track current page
  pageSize = 5;
  currentPage = 1;
  // Upload UI flags (show progress while file is being read/parsed)
  uploading = false;
  uploadProgress = 0;
  // Keeps the raw filename selected by the user (helpful for defaults / display)
  selectedFileName: string = '';
  // Form-level error message shown in the modal when validation fails
  formError: string = '';
  // Error shown for manual budget entry validation
  manualFormError: string = '';
  // Tracks zero-based indexes of rows that are currently invalid
  invalidRowIndexes: number[] = [];
  // Record empty fields(BUdget Name,Category,Date,Department)
  invalidFields: { [key: string]:boolean} = {
    budgetName: false,
    category: false,
    date: false,
    department: false
  };
  //Record empty fields for manual entry
  invalidManualEntry: { [key: string]:boolean} = {
    code: false,
    item: false,
    amount: false,
    description: false
  }
  // Store user roles
  userRole: string = '';
  constructor(private userService: UserService) {}

  ngOnInit(): void {
    // Try to resolve the logged-in user from navigation state first. Many flows pass
    // user information via `history.state` when routing from login -> dashboard.
    const loggedUser = history.state.user;
    console.log("loggeduser",loggedUser)
    if (loggedUser) {
      // Use a friendly name if available
      this.loggedUserName = loggedUser.name;
      this.userRole = loggedUser.role;
    } else {
      // Otherwise, attempt to read a stored user object from localStorage. Different
      // projects use different keys; we try a couple of common ones here.
      const stored = localStorage.getItem('loggeduser') || localStorage.getItem('user') || '';
      if (stored) {
        try {
          const obj = JSON.parse(stored);
          this.loggedUserName = obj.name;
          this.userRole = obj.role;
        } catch {
          // If the stored value wasn't JSON, just use the raw string as a fallback
          this.loggedUserName = stored;
          this.userRole = '';
        }
      }
    }

    // Debugging aid: show what we resolved for the logged-in user
    console.log('Logged in user:', loggedUser, 'resolved id:', this.loggedUserName);

    // Load users to populate the dashboard's user list. This demonstrates how the
    // component interacts with an HTTP-backed service. Error handling writes a
    // message to `errorMessage` which the template can show.
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        console.log('Fetched users:', data);
      },
      error: (err) => {
        this.errorMessage = 'Failed to load users: ' + (err.error?.message || err.message);
      }
    });
  }

  /**
   * Recomputes which rows are invalid (missing required columns).
   * Populates `invalidRowIndexes` with indexes into `bulkBudgets`.
   * Returns true if there are any invalid rows.
   */
  // Make this public because the template calls it via (ngModelChange)
  computeInvalidRows() {
    console.log("computeInvalidRows called",this.invalidRowIndexes)
    this.invalidRowIndexes = [];
    for (let i = 0; i < this.bulkBudgets.length; i++) {
      const r = this.bulkBudgets[i];
      // The template and other code use `item`, `amount`, `description`, `code`
      const missing = !r || !r.item || r.item.toString().trim() === ''
        || r.amount == null || r.amount === '' || isNaN(Number(r.amount))
        || !r.description || r.description.toString().trim() === ''
        || !r.code || r.code.toString().trim() === '';
      if (missing) this.invalidRowIndexes.push(i);
    }
    console.log("invalid roxxxx",this.invalidRowIndexes)
    return this.invalidRowIndexes;
  }
  // Return index if row is invalid
  isRowInvalid(index: number): boolean {
    return this.invalidRowIndexes.includes(index);
  }

  // Validate manual entry
  validateManualEntry(){
    this.invalidManualEntry = {
      code: !this.manualBudget.code || this.manualBudget.code.trim() === '',
      item: !this.manualBudget.item || this.manualBudget.item.trim() === '',
      amount: this.manualBudget.amount == null || isNaN(Number(this.manualBudget.amount)),
      description: !this.manualBudget.description || this.manualBudget.description.trim() === ''
    }
  }
  //Call this func whenever form fields change
  onManualFieldChange(fieldName: string){
    this.manualFormError = '';
    this.invalidManualEntry[fieldName] = false;
  }
  isManualFieldInvalid(fieldName: string): boolean {
    return this.invalidManualEntry[fieldName];
  }
  // Manual Budget Entry
  onSubmitBudget() {
    // console.log("manualerror",this.manualFormError)
    // console.log('Manual budget submitted:',this.manualBudget);
    // console.log(this.manualBudget.item)
    // console.log(this.manualBudget.item == '')
    // console.log(this.manualBudget.amount)
    // console.log(this.manualBudget.amount == '')
    // console.log(this.manualBudget.description)
    // console.log(this.manualBudget.description == '')
    // console.log(this.manualBudget.code)
    // console.log(this.manualBudget.code == '')
    // console.log(this.subledgerCode)

    //Check if fields are null or empty string
    this.validateManualEntry();
    // Check if any required fields are invalid
    const invalidManualFields = Object.values(this.invalidManualEntry).some(invalid => invalid);
    if (invalidManualFields) {
        this.manualFormError = 'Please fill all fields for the manual budget entry.';
        return;
        }
    // Validate the manual entry has the minimum required fields. This is a light
    // guard; the template should also provide form-level validation for better UX.
    if (this.manualBudget.code && this.manualBudget.item && this.manualBudget.amount && this.manualBudget.description) {
      this.manualFormError = '';
      const newBudget = {
        item: this.manualBudget.item,
        amount: this.manualBudget.amount,
        description: this.manualBudget.description,
        code: this.manualBudget.code
      };

      // We reuse the same editable array (bulkBudgets) so manual rows and uploaded
      // rows are presented in one unified table before final submission.
      this.bulkBudgets.push(newBudget);

      // Ensure pagination stays valid after adding a new row. Move to last
      // page if necessary so the newly added row is visible to the user.
      this.currentPage = this.totalPages;

      // Clear the manual input so the user can add another row if desired
      this.manualBudget = { code:'', item: '', amount: null, description: '' };
    }
  }

  // Bulk Upload Handler (Excel)
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.uploading = true;
    this.uploadProgress = 0;

    const reader = new FileReader();

    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      // Assume first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert sheet to JSON
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Set budgetName from file (editable)
      // this.selectedFileName = file.name;
    // Note: Do NOT default `budgetName` (or other metadata) from the file name.
    // The user requested fields not be auto-filled. Keep `budgetName` empty so
    // the user can choose to enter it (or leave it blank for uploads).

      // Optional: Map JSON keys to match your budget model
      this.bulkBudgets = jsonData.map(row => ({
        item: row['Item'] || '',
        amount: row['Amount'] || '',
        description: row['Description'] || '',
        code: row['Subledger Code'] || ''
      }));

      // Reset to the first page when a fresh file is loaded
      this.currentPage = 1;

      this.uploadProgress = 100;
      setTimeout(() => {
        this.uploading = false;
        // After parsing the file, compute invalid rows so the UI highlights them
        this.computeInvalidRows();
      }, 500); // small delay to show 100%
    };

    reader.readAsArrayBuffer(file);
}


  // Remove a budget row from bulkBudgets
  removeBulkBudget(index: number) {
    // Remove an editable row — this modifies the array the template iterates over
    this.bulkBudgets.splice(index, 1);
    // If the current page is now out of range (e.g. last item removed),
    // clamp it to the available pages so the UI doesn't show an empty page.
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    // Recompute invalid rows after a change
    this.computeInvalidRows();
  }

  // Pagination helpers
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.bulkBudgets.length / this.pageSize));
  }

  // Returns the budgets for the currently visible page
  get pagedBudgets(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.bulkBudgets.slice(start, start + this.pageSize);
  }

  // Navigate to a specific page (clamped)
  goToPage(page: number) {
    if (page < 1) page = 1;
    if (page > this.totalPages) page = this.totalPages;
    this.currentPage = page;
  }

  // Convenience: previous/next navigation
  prevPage() { this.goToPage(this.currentPage - 1); }
  nextPage() { this.goToPage(this.currentPage + 1); }

  // Compute the total amount across all budget rows (used in the table footer)
  get totalAmount(): number {
    return this.bulkBudgets.reduce((sum, row) => {
      const val = Number(row?.amount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }

  // Check form validity
  validateFormFields(){
    this.invalidFields = {
      budgetName: !this.budgetName || this.budgetName.trim() === '',
      category: !this.category || this.category.trim() === '',
      date: !this.date || this.date.trim() === '',
      department: !this.department || this.department.trim() === ''
    };
  }
  //Call this func whenever form fields change
  onFieldChange(fieldName: string){
    this.formError = '';
    this.invalidFields[fieldName] = false;
  }
  isFieldInvalid(fieldName: string): boolean {
    return this.invalidFields[fieldName];
  }

  // Submit all bulk budgets (finalize)
  submitBulkBudgets() {
    // Clear previous error
    this.formError = '';

    //Validate fields
    this.validateFormFields();

    // Check if any required fields are invalid
    const invalidFormFields = Object.values(this.invalidFields).some(invalid => invalid);
    if (invalidFormFields) {
      console.log("iff",invalidFormFields)
      console.log("invalidFields",this.invalidFields)
      this.formError = 'Please fill all required fields above.';
      return;
    }

    // Row-level validation: ensure every table row has required fields
    const hasInvalidRows = this.computeInvalidRows();
    if (hasInvalidRows.length > 0) {
      // Show a single, concise error and visually highlight offending rows
      this.formError = 'Some rows are missing required fields.';
      console.log("invalidRowIndexes",hasInvalidRows)
      return;
    }

    // Prepare payload with single budget name and all items
    const payload = {
      items: this.bulkBudgets,
      name: this.loggedUserName,
      budgetName: this.budgetName,
      category: this.category,
      date: this.date,
      department: this.department,
      total: this.totalAmount,
      status: 'Submitted'
    };
    
    //Show confirmation alert
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Confirm!'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire(
          'Submitted!',
          'Your budget has been submitted for approval.',
          'success'
        );
        // TODO: send `payload` to your backend. For now show alert for demo
        alert('Budgets submitted: ' + JSON.stringify(payload, null, 50));
        // Reset state
        this.bulkBudgets = [];
        this.budgetName = '';
        this.selectedFileName = '';
        this.category = '';
        this.date = '';
        this.department = '';
        this.formError = '';
        this.showBudgetForm = false;
      }
    });
  }

  // Draft all bulk budgets (draft)
  draftBulkBudgets() {
    // Clear previous error
    this.formError = '';

    //Validate fields
    this.validateFormFields();

    // Check if any required fields are invalid
    const invalidFormFields = Object.values(this.invalidFields).some(invalid => invalid);
    if (invalidFormFields) {
      this.formError = 'Please fill all required fields above.';
      return;
    }

    // Row-level validation for draft as well
    const hasInvalidRows = this.computeInvalidRows();
    if (hasInvalidRows.length > 0) {
      // Show a single, concise error and visually highlight offending rows
      this.formError = 'Some rows are missing required fields.';

      console.log("invalidRowIndexes",hasInvalidRows)
      return;
    }

    // Prepare payload with single budget name and all items
    const draftpayload = {
      items: this.bulkBudgets,
      name: this.loggedUserName,
      budgetName: this.budgetName,
      category: this.category,
      date: this.date,
      department: this.department,
      total: this.totalAmount,
      status: 'Draft'
    };

    Swal.fire({
      title: 'Are you sure?',
      text: "You can edit this later from Drafts.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Confirm!'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire(
          'Drafted!',
          'Your budget has been saved as draft.',
          'success'
        );
        // TODO: send `payload` to your backend. For now show alert for demo
        alert('Budgets saved as draft: ' + JSON.stringify(draftpayload, null, 50));

        // Reset state
        this.bulkBudgets = [];
        this.budgetName = '';
        this.selectedFileName = '';
        this.category = '';
        this.date = '';
        this.department = '';
        this.formError = '';
        this.showBudgetForm = false;
      }
    });
  }

  // Cancel bulk budgets and close form
  cancelBulkBudgets() {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Confirm'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire(
          'Cancelled!',
          'Budget upload cancelled.',
          'success'
        );
        this.bulkBudgets = [];
        this.manualBudget = { code:'', item: '', amount: null, description: '' };
        this.budgetName = '';
        this.selectedFileName = '';
        this.category = '';
        this.date = '';
        this.department = '';
        this.formError = '';
        this.showBudgetForm = false;
      }
    });
    // this.bulkBudgets = [];
    // this.manualBudget = { code:'', item: '', amount: null, description: '' };
    // this.budgetName = '';
    // this.selectedFileName = '';
    // this.category = '';
    // this.date = '';
    // this.department = '';
    // this.formError = '';
    // this.showBudgetForm = false;
  }
}
