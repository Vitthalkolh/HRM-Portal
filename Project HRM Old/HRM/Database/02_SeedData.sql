/*=============================================================================
  HRM PORTAL - SEED DATA
  Run after 01_Schema.sql
  Seed logins:  admin / Admin@123        (administrator)
                rushikesh / Employee@123 (and sneha, vitthal, priya, amit)
  Password format: PBKDF2$<iterations>$<base64 salt>$<base64 key>  (HMAC-SHA256)
=============================================================================*/

USE HRM;
GO

/*---------------------------------------------------------------------------
  LEAVE_STATUS
---------------------------------------------------------------------------*/
INSERT INTO dbo.LEAVE_STATUS (ID, NAME) VALUES
    (1, 'Pending'),
    (2, 'Approved'),
    (3, 'Rejected'),
    (4, 'Cancelled');
GO

/*---------------------------------------------------------------------------
  LEAVE_TYPES
  Work From Home and Management Leave still need approval but are not
  deducted from an annual quota (IS_BALANCE_TRACKED = 0).
  National Holiday is company-wide and cannot be applied for (IS_APPLICABLE = 0).
---------------------------------------------------------------------------*/
SET IDENTITY_INSERT dbo.LEAVE_TYPES ON;

INSERT INTO dbo.LEAVE_TYPES
    (ID, CODE, NAME, DEFAULT_ENTITLEMENT, IS_PAID, ALLOW_HALF_DAY,
     IS_BALANCE_TRACKED, IS_APPLICABLE, COLOR_CODE, DISPLAY_ORDER, IS_ACTIVE)
VALUES
    (1, 'EL',  'Earned Leave',      15.00, 1, 1, 1, 1, '#2E7D32', 1, 1),
    (2, 'SL',  'Sick Leave',         8.00, 1, 1, 1, 1, '#C62828', 2, 1),
    (3, 'CL',  'Casual Leave',       6.00, 1, 1, 1, 1, '#1565C0', 3, 1),
    (4, 'FL',  'Floater Leave',      5.00, 1, 0, 1, 1, '#EF6C00', 4, 1),
    (5, 'WFH', 'Work From Home',     0.00, 1, 1, 0, 1, '#6A1B9A', 5, 1),
    (6, 'ML',  'Management Leave',   0.00, 1, 1, 0, 1, '#00838F', 6, 1),
    (7, 'NH',  'National Holiday',   0.00, 1, 0, 0, 0, '#455A64', 7, 1);

SET IDENTITY_INSERT dbo.LEAVE_TYPES OFF;
GO

/*---------------------------------------------------------------------------
  USERS
---------------------------------------------------------------------------*/
INSERT INTO dbo.USERS
    (USERNAME, PASSWORD_HASH, EMPLOYEE_CODE, FIRST_NAME, LAST_NAME, EMAIL,
     MOBILE_NO, CITY, DESIGNATION, DEPARTMENT, DATE_OF_BIRTH, JOINING_DATE,
     IS_ADMIN, IS_ACTIVE, CREATED_BY)
VALUES
    ('admin',
     'PBKDF2$100000$E60DRlbCAVDtQBT/y/k30A==$Lw3SrjtaFsC9/aVwRdTnRhF/l7mkc3j1dHpR40pQd6E=',
     '00001', 'System', 'Administrator', 'admin@company.com',
     '9000000001', 'Pune', 'HR Manager', 'Human Resources',
     '1988-04-12', '2020-01-06', 1, 1, NULL),

    ('rushikesh',
     'PBKDF2$100000$lbN0qYdw0tkcDc0e8k6dMg==$LIYIOjpeLErS9zmEn3zIVSt5vqVONyiz2XNnZCzGbj0=',
     '00210', 'Rushikesh', 'Pokharkar', 'rushikesh@company.com',
     '8767650128', 'Pune', 'Software Engineer II', 'Engineering',
     '1996-09-24', '2022-07-12', 0, 1, 1),

    ('sneha',
     'PBKDF2$100000$XPmE6OCzf2zVuTgO5X3TBQ==$2tpxxLTV6p3v3Burf2tbg26eAd7ghdycysNOtqTJM0M=',
     '00211', 'Sneha', 'Deshmukh', 'sneha@company.com',
     '9822011223', 'Pune', 'QA Engineer', 'Engineering',
     '1997-09-28', '2023-02-01', 0, 1, 1),

    ('vitthal',
     'PBKDF2$100000$MlutZGueyGlGCDiIMZ9RpQ==$iKSKkLcFxP32kC0OgsxsLDLXwxsy5BL0dFcvi2tvwNU=',
     '00212', 'Vitthal', 'Kolhe', 'vitthal@company.com',
     '9822011224', 'Mumbai', 'Team Lead', 'Engineering',
     '1993-01-15', '2021-05-17', 0, 1, 1),

    ('priya',
     'PBKDF2$100000$zGcsSJKM+EzpIprY/uzltQ==$ROOOzZa36Z3GrbKuowL1Jhw5a2UhTNK6XNkp80Wxx/k=',
     '00213', 'Priya', 'Sharma', 'priya@company.com',
     '9822011225', 'Bengaluru', 'Business Analyst', 'Delivery',
     '1995-10-02', '2022-11-21', 0, 1, 1),

    ('amit',
     'PBKDF2$100000$cwJysU1syqHMEutoQttgEw==$R5LaBYikYW22CfU32/Eqd1vlspdKvzQVYe5GHo5QTpw=',
     '00214', 'Amit', 'Rane', 'amit@company.com',
     '9822011226', 'Pune', 'DevOps Engineer', 'Infrastructure',
     '1991-12-30', '2019-08-05', 0, 1, 1);
GO

-- Reporting lines: everyone except the admin reports to Vitthal (Team Lead).
UPDATE dbo.USERS
SET    REPORTING_MANAGER_ID = (SELECT ID FROM dbo.USERS WHERE USERNAME = 'vitthal')
WHERE  USERNAME IN ('rushikesh', 'sneha', 'priya', 'amit');
GO

/*---------------------------------------------------------------------------
  COMPANY_HOLIDAYS - national (fixed) and optional (floater) for 2026
---------------------------------------------------------------------------*/
INSERT INTO dbo.COMPANY_HOLIDAYS
    (HOLIDAY_DATE, LEAVE_TYPE_ID, NAME, IS_OPTIONAL, IS_ACTIVE, CREATED_BY)
VALUES
    -- National / fixed holidays (LEAVE_TYPE_ID 7)
    ('2026-01-01', 7, 'New Year Day',          0, 1, 1),
    ('2026-01-26', 7, 'Republic Day',          0, 1, 1),
    ('2026-05-01', 7, 'Labour Day',            0, 1, 1),
    ('2026-08-15', 7, 'Independence Day',      0, 1, 1),
    ('2026-10-02', 7, 'Gandhi Jayanti',        0, 1, 1),
    ('2026-12-25', 7, 'Christmas',             0, 1, 1),
    -- Optional / floater holidays (LEAVE_TYPE_ID 4)
    ('2026-01-14', 4, 'Pongal / Sankranti',    1, 1, 1),
    ('2026-03-04', 4, 'Holi',                  1, 1, 1),
    ('2026-04-03', 4, 'Good Friday',           1, 1, 1),
    ('2026-08-28', 4, 'Raksha Bandhan',        1, 1, 1),
    ('2026-09-04', 4, 'Janmashtami',           1, 1, 1),
    ('2026-09-14', 4, 'Ganesh Chaturthi',      1, 1, 1),
    ('2026-10-20', 4, 'Dussehra',              1, 1, 1),
    ('2026-11-08', 4, 'Diwali - Bhaubeej',     1, 1, 1);
GO

/*---------------------------------------------------------------------------
  AUTO_EMAIL_NOTIFICATION - {{Placeholder}} tokens are replaced in EmailService
---------------------------------------------------------------------------*/
INSERT INTO dbo.AUTO_EMAIL_NOTIFICATION (ID, CODE, NAME, SUBJECT, BODY, IS_ACTIVE)
VALUES
    (1, 'LEAVE_APPROVED', 'Leave Approved',
     'Your leave request has been approved',
     '<p>Hi {{EmployeeName}},</p><p>Your <b>{{LeaveType}}</b> from <b>{{FromDate}}</b> to <b>{{ToDate}}</b> ({{TotalDays}} day(s)) has been <b>approved</b> by {{ActionBy}}.</p><p>Regards,<br/>HR Team</p>', 1),

    (2, 'LEAVE_REJECTED', 'Leave Rejected',
     'Your leave request has been rejected',
     '<p>Hi {{EmployeeName}},</p><p>Your <b>{{LeaveType}}</b> from <b>{{FromDate}}</b> to <b>{{ToDate}}</b> has been <b>rejected</b> by {{ActionBy}}.</p><p>Reason: {{Reason}}</p><p>Regards,<br/>HR Team</p>', 1),

    (3, 'LEAVE_CANCELLED', 'Leave Cancelled',
     'Your approved leave has been cancelled',
     '<p>Hi {{EmployeeName}},</p><p>Your approved <b>{{LeaveType}}</b> from <b>{{FromDate}}</b> to <b>{{ToDate}}</b> has been <b>cancelled</b> by {{ActionBy}}. The balance has been credited back to your account.</p><p>Regards,<br/>HR Team</p>', 1),

    (4, 'BIRTHDAY', 'Birthday Wish',
     'Happy Birthday {{EmployeeName}}!',
     '<p>Wishing you a very happy birthday, {{EmployeeName}}!</p><p>Regards,<br/>HR Team</p>', 1),

    (5, 'WORK_ANNIVERSARY', 'Work Anniversary',
     'Happy Work Anniversary {{EmployeeName}}!',
     '<p>Congratulations {{EmployeeName}} on completing {{Years}} year(s) with us!</p><p>Regards,<br/>HR Team</p>', 1),

    (6, 'LEAVE_APPLIED', 'Leave Applied',
     'New leave request awaiting your approval',
     '<p>Hi Admin,</p><p><b>{{EmployeeName}}</b> has applied for <b>{{LeaveType}}</b> from <b>{{FromDate}}</b> to <b>{{ToDate}}</b> ({{TotalDays}} day(s)).</p><p>Reason: {{Reason}}</p><p>Please review it in the HRM portal.</p>', 1);
GO

PRINT 'HRM seed data inserted.';
GO
