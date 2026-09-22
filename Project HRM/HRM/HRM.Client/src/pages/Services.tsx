import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DownloadIcon from '@mui/icons-material/Download';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useRef, useState, type ChangeEvent } from 'react';
import { downloadFile, employeeApi, referralApi, reimbursementApi, salaryApi } from '../api/services';
import type { ExpenseClaim, Referral, ReferralStatus, ReviewStatus } from '../api/types';
import { DataState, useToast } from '../components/feedback';
import { BusyButton, PageHeader, StatusChip } from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { monthNames, formatAmount, formatBytes, formatDate, formatDateTime, today } from '../utils/format';

// ---------------------------------------------------------------- salary slips

export function SalarySlipsPage() {
  const { isAdmin } = useAuth();
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [year, setYear] = useState(new Date().getFullYear());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [file, setFile] = useState<File | null>(null);

  const slips = useApi(() => salaryApi.list(undefined, year), [year]);
  const directory = useApi(() => (isAdmin ? employeeApi.directory() : Promise.resolve([])), [isAdmin]);

  const upload = async () => {
    if (employeeId === '' || !file) return;
    const result = await run(() => salaryApi.upload(employeeId, year, month, file));
    if (result) {
      notify(result.message, 'success');
      setUploadOpen(false);
      setFile(null);
      slips.reload();
    }
  };

  const download = async (id: number, label: string) => {
    await run(() => downloadFile(salaryApi.downloadUrl(id), `${label}.pdf`));
  };

  return (
    <Box>
      <PageHeader
        overline="SERVICES"
        title="Salary slips"
        description={
          isAdmin
            ? 'Upload monthly salary slips. Each employee can only download their own.'
            : 'Your monthly salary slips. Only you and your administrator can open them.'
        }
        action={
          isAdmin ? (
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setUploadOpen(true)}>
              Upload slip
            </Button>
          ) : undefined
        }
      />

      <Card>
        <Stack sx={{ p: 2.5, pb: 1.5 }}>
          <TextField
            select
            label="Year"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            sx={{ maxWidth: 160 }}
          >
            {[year + 1, year, year - 1, year - 2].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <DataState
            loading={slips.loading}
            error={slips.error}
            data={slips.data}
            onRetry={slips.reload}
            emptyTitle="No salary slips"
            emptyDescription={`Nothing has been uploaded for ${year}.`}
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell>
                      {isAdmin && <TableCell>Employee</TableCell>}
                      <TableCell>Uploaded</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell align="right">Download</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((slip) => (
                      <TableRow key={slip.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {slip.monthName} {slip.year}
                          </Typography>
                        </TableCell>
                        {isAdmin && <TableCell>{slip.employeeName}</TableCell>}
                        <TableCell>{formatDateTime(slip.uploadedAtUtc)}</TableCell>
                        <TableCell>{formatBytes(slip.sizeBytes)}</TableCell>
                        <TableCell align="right">
                          <BusyButton
                            busy={busy}
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={() => download(slip.id, `salary-slip-${slip.year}-${slip.month}`)}
                          >
                            Download
                          </BusyButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DataState>
        </Box>
      </Card>

      <Dialog open={uploadOpen} onClose={busy ? undefined : () => setUploadOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Upload salary slip</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Employee"
              value={employeeId}
              onChange={(event) => setEmployeeId(Number(event.target.value))}
            >
              {(directory.data ?? []).map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.employeeCode})
                </MenuItem>
              ))}
            </TextField>

            <Stack direction="row" spacing={2}>
              <TextField select label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {[year + 1, year, year - 1].map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                {monthNames.map((name, index) => (
                  <MenuItem key={name} value={index + 1}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
              {file ? file.name : 'Choose PDF'}
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              PDF only, up to 5 MB. Uploading again for the same month replaces the existing slip.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setUploadOpen(false)} disabled={busy} color="inherit">
            Cancel
          </Button>
          <BusyButton
            variant="contained"
            busy={busy}
            busyLabel="Uploading…"
            onClick={upload}
            disabled={employeeId === '' || !file}
          >
            Upload
          </BusyButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------- reimbursements

const expenseTypes = ['Travel', 'Accommodation', 'Meals', 'Internet', 'Training', 'Equipment', 'Other'];

export function ReimbursementsPage() {
  const { isAdmin } = useAuth();
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    expenseType: 'Travel', expenseDate: today(), amount: '', description: '', referenceUrl: '',
  });
  const [review, setReview] = useState<ExpenseClaim | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('Approved');
  const [adminNotes, setAdminNotes] = useState('');
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [attachTarget, setAttachTarget] = useState<number | null>(null);

  const claims = useApi(
    () => reimbursementApi.list({ status: status || undefined, pageSize: 50 }),
    [status],
  );

  const create = async () => {
    const result = await run(() =>
      reimbursementApi.create({
        expenseType: form.expenseType,
        expenseDate: form.expenseDate,
        amount: Number(form.amount),
        description: form.description.trim(),
        referenceUrl: form.referenceUrl.trim() || null,
      }),
    );
    if (result) {
      notify(result.message, 'success');
      setFormOpen(false);
      setForm({ expenseType: 'Travel', expenseDate: today(), amount: '', description: '', referenceUrl: '' });
      claims.reload();
    }
  };

  const submitReview = async () => {
    if (!review) return;
    const result = await run(() => reimbursementApi.review(review.id, reviewStatus, adminNotes.trim() || null));
    if (result) {
      notify(result.message, 'success');
      setReview(null);
      setAdminNotes('');
      claims.reload();
    }
  };

  const attach = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen || attachTarget === null) return;

    const result = await run(() => reimbursementApi.uploadAttachment(attachTarget, chosen));
    if (result) {
      notify(result.message, 'success');
      claims.reload();
    }
  };

  return (
    <Box>
      <PageHeader
        overline="SERVICES"
        title="Reimbursements"
        description={
          isAdmin
            ? 'Review expense claims submitted by employees.'
            : 'Claim back approved work expenses. Attach a receipt or share a reference link.'
        }
        action={
          !isAdmin ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
              New claim
            </Button>
          ) : undefined
        }
      />

      <input ref={attachmentInput} type="file" accept="application/pdf,image/*" hidden onChange={attach} />

      <Card>
        <Stack sx={{ p: 2.5, pb: 1.5 }}>
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            sx={{ maxWidth: 220 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {['Pending', 'Approved', 'Rejected'].map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <DataState
            loading={claims.loading}
            error={claims.error}
            data={claims.data?.items}
            onRetry={claims.reload}
            emptyTitle="No claims found"
            emptyDescription={isAdmin ? 'No claims match this filter.' : 'You have not submitted any claims yet.'}
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Expense</TableCell>
                      {isAdmin && <TableCell>Employee</TableCell>}
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((claim) => (
                      <TableRow key={claim.id} hover>
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {claim.expenseType}
                          </Typography>
                          <Tooltip title={claim.description}>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {claim.description}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        {isAdmin && <TableCell>{claim.employeeName}</TableCell>}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(claim.expenseDate)}</TableCell>
                        <TableCell align="right">{formatAmount(claim.amount)}</TableCell>
                        <TableCell>
                          <StatusChip status={claim.status} />
                          {claim.adminNotes && (
                            <Tooltip title={claim.adminNotes}>
                              <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ maxWidth: 140 }}>
                                “{claim.adminNotes}”
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {claim.referenceUrl && (
                              <Tooltip title="Open reference link">
                                <IconButton size="small" href={claim.referenceUrl} target="_blank" rel="noreferrer">
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {claim.attachmentFileId && (
                              <Tooltip title="Download attachment">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    run(() =>
                                      downloadFile(reimbursementApi.attachmentUrl(claim.id), `claim-${claim.id}`),
                                    )
                                  }
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {!isAdmin && claim.status === 'Pending' && (
                              <Button
                                size="small"
                                startIcon={<AttachFileIcon />}
                                onClick={() => {
                                  setAttachTarget(claim.id);
                                  attachmentInput.current?.click();
                                }}
                              >
                                Attach
                              </Button>
                            )}
                            {isAdmin && claim.status === 'Pending' && (
                              <Button size="small" variant="outlined" onClick={() => setReview(claim)}>
                                Review
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DataState>
        </Box>
      </Card>

      <Dialog open={formOpen} onClose={busy ? undefined : () => setFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New reimbursement claim</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Expense type"
              value={form.expenseType}
              onChange={(event) => setForm({ ...form, expenseType: event.target.value })}
            >
              {expenseTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Expense date"
              type="date"
              value={form.expenseDate}
              onChange={(event) => setForm({ ...form, expenseDate: event.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
            />
            <TextField
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              required
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              multiline
              minRows={2}
              required
            />
            <TextField
              label="Reference link (optional)"
              value={form.referenceUrl}
              onChange={(event) => setForm({ ...form, referenceUrl: event.target.value })}
              placeholder="https://…"
              helperText="You can attach a receipt after creating the claim."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setFormOpen(false)} disabled={busy} color="inherit">
            Cancel
          </Button>
          <BusyButton
            variant="contained"
            busy={busy}
            busyLabel="Submitting…"
            onClick={create}
            disabled={Number(form.amount) <= 0 || form.description.trim().length === 0}
          >
            Submit claim
          </BusyButton>
        </DialogActions>
      </Dialog>

      <Dialog open={review !== null} onClose={busy ? undefined : () => setReview(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Review claim</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {review?.employeeName} · {review?.expenseType} · {review ? formatAmount(review.amount) : ''}
          </Typography>
          <Stack spacing={2}>
            <TextField
              select
              label="Decision"
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as ReviewStatus)}
            >
              <MenuItem value="Approved">Approve</MenuItem>
              <MenuItem value="Rejected">Reject</MenuItem>
            </TextField>
            <TextField
              label="Notes (optional)"
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setReview(null)} disabled={busy} color="inherit">
            Cancel
          </Button>
          <BusyButton variant="contained" busy={busy} busyLabel="Saving…" onClick={submitReview}>
            Save decision
          </BusyButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------- referrals

const referralStatuses: ReferralStatus[] = ['Submitted', 'Screening', 'Interviewing', 'Hired', 'Rejected'];

export function ReferralsPage() {
  const { isAdmin } = useAuth();
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    candidateName: '', candidateEmail: '', candidatePhone: '', position: '', linkedInUrl: '', notes: '',
  });
  const [review, setReview] = useState<Referral | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReferralStatus>('Screening');
  const [internalNotes, setInternalNotes] = useState('');
  const resumeInput = useRef<HTMLInputElement>(null);
  const [resumeTarget, setResumeTarget] = useState<number | null>(null);

  const referrals = useApi(() => referralApi.list({ status: status || undefined, pageSize: 50 }), [status]);

  const create = async () => {
    const result = await run(() =>
      referralApi.create({
        candidateName: form.candidateName.trim(),
        candidateEmail: form.candidateEmail.trim(),
        candidatePhone: form.candidatePhone.trim() || null,
        position: form.position.trim(),
        linkedInUrl: form.linkedInUrl.trim() || null,
        notes: form.notes.trim() || null,
      }),
    );
    if (result) {
      notify(result.message, 'success');
      setFormOpen(false);
      setForm({ candidateName: '', candidateEmail: '', candidatePhone: '', position: '', linkedInUrl: '', notes: '' });
      referrals.reload();
    }
  };

  const submitReview = async () => {
    if (!review) return;
    const result = await run(() => referralApi.review(review.id, reviewStatus, internalNotes.trim() || null));
    if (result) {
      notify(result.message, 'success');
      setReview(null);
      setInternalNotes('');
      referrals.reload();
    }
  };

  const uploadResume = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen || resumeTarget === null) return;

    const result = await run(() => referralApi.uploadResume(resumeTarget, chosen));
    if (result) {
      notify(result.message, 'success');
      referrals.reload();
    }
  };

  return (
    <Box>
      <PageHeader
        overline="SERVICES"
        title="Referrals"
        description={
          isAdmin
            ? 'Candidates referred by employees. Internal notes are visible only to administrators.'
            : 'Refer someone you would like to work with. You will see their progress here.'
        }
        action={
          !isAdmin ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
              Refer a candidate
            </Button>
          ) : undefined
        }
      />

      <input ref={resumeInput} type="file" accept="application/pdf" hidden onChange={uploadResume} />

      <Card>
        <Stack sx={{ p: 2.5, pb: 1.5 }}>
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            sx={{ maxWidth: 220 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {referralStatuses.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <DataState
            loading={referrals.loading}
            error={referrals.error}
            data={referrals.data?.items}
            onRetry={referrals.reload}
            emptyTitle="No referrals found"
            emptyDescription={isAdmin ? 'No referrals match this filter.' : 'You have not referred anyone yet.'}
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Candidate</TableCell>
                      <TableCell>Position</TableCell>
                      {isAdmin && <TableCell>Referred by</TableCell>}
                      <TableCell>Submitted</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((referral) => (
                      <TableRow key={referral.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {referral.candidateName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {referral.candidateEmail}
                          </Typography>
                        </TableCell>
                        <TableCell>{referral.position}</TableCell>
                        {isAdmin && <TableCell>{referral.referredBy}</TableCell>}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(referral.createdAtUtc)}</TableCell>
                        <TableCell>
                          <StatusChip status={referral.status} />
                          {isAdmin && referral.internalNotes && (
                            <Tooltip title={referral.internalNotes}>
                              <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ maxWidth: 150 }}>
                                {referral.internalNotes}
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {referral.linkedInUrl && (
                              <Tooltip title="Open LinkedIn profile">
                                <IconButton size="small" href={referral.linkedInUrl} target="_blank" rel="noreferrer">
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {referral.resumeFileId ? (
                              <Tooltip title="Download resume">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    run(() =>
                                      downloadFile(
                                        referralApi.resumeUrl(referral.id),
                                        `${referral.candidateName}-resume.pdf`,
                                      ),
                                    )
                                  }
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              !isAdmin && (
                                <Button
                                  size="small"
                                  startIcon={<AttachFileIcon />}
                                  onClick={() => {
                                    setResumeTarget(referral.id);
                                    resumeInput.current?.click();
                                  }}
                                >
                                  Resume
                                </Button>
                              )
                            )}
                            {isAdmin && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setReview(referral);
                                  setReviewStatus(referral.status);
                                  setInternalNotes(referral.internalNotes ?? '');
                                }}
                              >
                                Update
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DataState>
        </Box>
      </Card>

      <Dialog open={formOpen} onClose={busy ? undefined : () => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Refer a candidate</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Candidate name"
                value={form.candidateName}
                onChange={(event) => setForm({ ...form, candidateName: event.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Candidate email"
                type="email"
                value={form.candidateEmail}
                onChange={(event) => setForm({ ...form, candidateEmail: event.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Phone (optional)"
                value={form.candidatePhone}
                onChange={(event) => setForm({ ...form, candidatePhone: event.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Position"
                value={form.position}
                onChange={(event) => setForm({ ...form, position: event.target.value })}
                required
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="LinkedIn (optional)"
                value={form.linkedInUrl}
                onChange={(event) => setForm({ ...form, linkedInUrl: event.target.value })}
                placeholder="https://linkedin.com/in/…"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Why they would be a good fit"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                multiline
                minRows={2}
                helperText="You can attach their resume after submitting."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setFormOpen(false)} disabled={busy} color="inherit">
            Cancel
          </Button>
          <BusyButton
            variant="contained"
            busy={busy}
            busyLabel="Submitting…"
            onClick={create}
            disabled={
              form.candidateName.trim().length === 0 ||
              !form.candidateEmail.includes('@') ||
              form.position.trim().length === 0
            }
          >
            Submit referral
          </BusyButton>
        </DialogActions>
      </Dialog>

      <Dialog open={review !== null} onClose={busy ? undefined : () => setReview(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Update referral</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {review?.candidateName} · {review?.position}
          </Typography>
          <Stack spacing={2}>
            <TextField
              select
              label="Status"
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as ReferralStatus)}
            >
              {referralStatuses.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Internal notes"
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              multiline
              minRows={3}
              helperText="Visible to administrators only. The referring employee sees the status only."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setReview(null)} disabled={busy} color="inherit">
            Cancel
          </Button>
          <BusyButton variant="contained" busy={busy} busyLabel="Saving…" onClick={submitReview}>
            Save
          </BusyButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
