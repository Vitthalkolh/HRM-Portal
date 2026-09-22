/*=============================================================================
  HRM PORTAL - DATABASE SCHEMA
  Run order: 01_Schema.sql -> 02_SeedData.sql -> 03_StoredProcedures.sql
  Target    : Microsoft SQL Server 2019+
=============================================================================*/

IF DB_ID('GroupA_HRM') IS NULL
BEGIN
    CREATE DATABASE GroupA_HRM;
END
GO

USE GroupA_HRM;
GO

/*---------------------------------------------------------------------------
  Drop existing objects (safe re-run)
---------------------------------------------------------------------------*/
IF OBJECT_ID('dbo.OPTIONAL_HOLIDAY_REQUESTS','U') IS NOT NULL DROP TABLE dbo.OPTIONAL_HOLIDAY_REQUESTS;
IF OBJECT_ID('dbo.EMPLOYEE_LEAVES','U')           IS NOT NULL DROP TABLE dbo.EMPLOYEE_LEAVES;
IF OBJECT_ID('dbo.EMPLOYEE_LEAVE_BALANCE','U')    IS NOT NULL DROP TABLE dbo.EMPLOYEE_LEAVE_BALANCE;
IF OBJECT_ID('dbo.COMPANY_HOLIDAYS','U')          IS NOT NULL DROP TABLE dbo.COMPANY_HOLIDAYS;
IF OBJECT_ID('dbo.AUTO_EMAIL_NOTIFICATION','U')   IS NOT NULL DROP TABLE dbo.AUTO_EMAIL_NOTIFICATION;
IF OBJECT_ID('dbo.USERS','U')                     IS NOT NULL DROP TABLE dbo.USERS;
IF OBJECT_ID('dbo.LEAVE_STATUS','U')              IS NOT NULL DROP TABLE dbo.LEAVE_STATUS;
IF OBJECT_ID('dbo.LEAVE_TYPES','U')               IS NOT NULL DROP TABLE dbo.LEAVE_TYPES;
GO

/*---------------------------------------------------------------------------
  LEAVE_TYPES
  IS_BALANCE_TRACKED = 1 -> application is checked against an annual quota.
  IS_APPLICABLE      = 0 -> employees cannot apply for it (national holidays).
---------------------------------------------------------------------------*/
CREATE TABLE dbo.LEAVE_TYPES
(
    ID                  INT IDENTITY(1,1) NOT NULL,
    CODE                VARCHAR(20)   NOT NULL,
    NAME                VARCHAR(100)  NOT NULL,
    DEFAULT_ENTITLEMENT DECIMAL(5,2)  NOT NULL CONSTRAINT DF_LEAVE_TYPES_ENT     DEFAULT (0),
    IS_PAID             BIT           NOT NULL CONSTRAINT DF_LEAVE_TYPES_PAID    DEFAULT (1),
    ALLOW_HALF_DAY      BIT           NOT NULL CONSTRAINT DF_LEAVE_TYPES_HALF    DEFAULT (1),
    IS_BALANCE_TRACKED  BIT           NOT NULL CONSTRAINT DF_LEAVE_TYPES_TRACK   DEFAULT (1),
    IS_APPLICABLE       BIT           NOT NULL CONSTRAINT DF_LEAVE_TYPES_APPLY   DEFAULT (1),
    COLOR_CODE          VARCHAR(10)   NULL,
    DISPLAY_ORDER       INT           NOT NULL CONSTRAINT DF_LEAVE_TYPES_ORDER   DEFAULT (0),
    IS_ACTIVE           BIT           NOT NULL CONSTRAINT DF_LEAVE_TYPES_ACTIVE  DEFAULT (1),
    CONSTRAINT PK_LEAVE_TYPES PRIMARY KEY (ID),
    CONSTRAINT UQ_LEAVE_TYPES_CODE UNIQUE (CODE)
);
GO

/*---------------------------------------------------------------------------
  LEAVE_STATUS  (1 Pending / 2 Approved / 3 Rejected / 4 Cancelled)
---------------------------------------------------------------------------*/
CREATE TABLE dbo.LEAVE_STATUS
(
    ID        INT          NOT NULL,
    NAME      VARCHAR(50)  NOT NULL,
    CONSTRAINT PK_LEAVE_STATUS PRIMARY KEY (ID)
);
GO

/*---------------------------------------------------------------------------
  USERS
---------------------------------------------------------------------------*/
CREATE TABLE dbo.USERS
(
    ID                    INT IDENTITY(1,1) NOT NULL,
    USERNAME              VARCHAR(100)  NOT NULL,
    PASSWORD_HASH         VARCHAR(255)  NOT NULL,
    EMPLOYEE_CODE         VARCHAR(20)   NULL,
    FIRST_NAME            VARCHAR(100)  NOT NULL,
    LAST_NAME             VARCHAR(100)  NOT NULL,
    EMAIL                 VARCHAR(150)  NOT NULL,
    MOBILE_NO             VARCHAR(20)   NULL,
    CITY                  VARCHAR(100)  NULL,
    DESIGNATION           VARCHAR(100)  NULL,
    DEPARTMENT            VARCHAR(100)  NULL,
    REPORTING_MANAGER_ID  INT           NULL,
    DATE_OF_BIRTH         DATE          NULL,
    JOINING_DATE          DATE          NOT NULL,
    COMPANY_LEAVING_DATE  DATE          NULL,
    IS_ADMIN              BIT           NOT NULL CONSTRAINT DF_USERS_ADMIN   DEFAULT (0),
    IS_ACTIVE             BIT           NOT NULL CONSTRAINT DF_USERS_ACTIVE  DEFAULT (1),
    CREATED_BY            INT           NULL,
    CREATED_DATE          DATETIME      NOT NULL CONSTRAINT DF_USERS_CREATED DEFAULT (GETDATE()),
    CHANGED_BY            INT           NULL,
    CHANGED_DATE          DATETIME      NULL,
    CONSTRAINT PK_USERS PRIMARY KEY (ID),
    CONSTRAINT UQ_USERS_USERNAME UNIQUE (USERNAME),
    CONSTRAINT FK_USERS_MANAGER FOREIGN KEY (REPORTING_MANAGER_ID) REFERENCES dbo.USERS(ID)
);
GO

CREATE INDEX IX_USERS_ACTIVE ON dbo.USERS (IS_ACTIVE) INCLUDE (FIRST_NAME, LAST_NAME, EMAIL);
GO

/*---------------------------------------------------------------------------
  EMPLOYEE_LEAVE_BALANCE  - one row per user / leave type / year
---------------------------------------------------------------------------*/
CREATE TABLE dbo.EMPLOYEE_LEAVE_BALANCE
(
    ID            INT IDENTITY(1,1) NOT NULL,
    USER_ID       INT           NOT NULL,
    LEAVE_TYPE_ID INT           NOT NULL,
    [YEAR]        INT           NOT NULL,
    ENTITLEMENT   DECIMAL(5,2)  NOT NULL CONSTRAINT DF_BAL_ENT  DEFAULT (0),
    USED          DECIMAL(5,2)  NOT NULL CONSTRAINT DF_BAL_USED DEFAULT (0),
    CREATED_BY    INT           NULL,
    CREATED_DATE  DATETIME      NOT NULL CONSTRAINT DF_BAL_CREATED DEFAULT (GETDATE()),
    CHANGED_BY    INT           NULL,
    CHANGED_DATE  DATETIME      NULL,
    CONSTRAINT PK_EMPLOYEE_LEAVE_BALANCE PRIMARY KEY (ID),
    CONSTRAINT UQ_BAL_USER_TYPE_YEAR UNIQUE (USER_ID, LEAVE_TYPE_ID, [YEAR]),
    CONSTRAINT FK_BAL_USER FOREIGN KEY (USER_ID)       REFERENCES dbo.USERS(ID),
    CONSTRAINT FK_BAL_TYPE FOREIGN KEY (LEAVE_TYPE_ID) REFERENCES dbo.LEAVE_TYPES(ID),
    CONSTRAINT CK_BAL_USED CHECK (USED >= 0)
);
GO

/*---------------------------------------------------------------------------
  COMPANY_HOLIDAYS
  IS_OPTIONAL = 1 -> floater / optional holiday the employee opts into.
---------------------------------------------------------------------------*/
CREATE TABLE dbo.COMPANY_HOLIDAYS
(
    ID            INT IDENTITY(1,1) NOT NULL,
    HOLIDAY_DATE  DATE          NOT NULL,
    LEAVE_TYPE_ID INT           NOT NULL,
    NAME          VARCHAR(150)  NOT NULL,
    IS_OPTIONAL   BIT           NOT NULL CONSTRAINT DF_HOL_OPTIONAL DEFAULT (0),
    IS_ACTIVE     BIT           NOT NULL CONSTRAINT DF_HOL_ACTIVE   DEFAULT (1),
    CREATED_BY    INT           NULL,
    CREATED_DATE  DATETIME      NOT NULL CONSTRAINT DF_HOL_CREATED  DEFAULT (GETDATE()),
    CHANGED_BY    INT           NULL,
    CHANGED_DATE  DATETIME      NULL,
    CONSTRAINT PK_COMPANY_HOLIDAYS PRIMARY KEY (ID),
    CONSTRAINT UQ_HOL_DATE_NAME UNIQUE (HOLIDAY_DATE, NAME),
    CONSTRAINT FK_HOL_TYPE FOREIGN KEY (LEAVE_TYPE_ID) REFERENCES dbo.LEAVE_TYPES(ID)
);
GO

CREATE INDEX IX_HOL_DATE ON dbo.COMPANY_HOLIDAYS (HOLIDAY_DATE, IS_ACTIVE, IS_OPTIONAL);
GO

/*---------------------------------------------------------------------------
  EMPLOYEE_LEAVES
  HALF_DAY_SESSION : 1 = First Half, 2 = Second Half (NULL for full days)
---------------------------------------------------------------------------*/
CREATE TABLE dbo.EMPLOYEE_LEAVES
(
    ID               INT IDENTITY(1,1) NOT NULL,
    USER_ID          INT           NOT NULL,
    LEAVE_TYPE_ID    INT           NOT NULL,
    FROM_DATE        DATE          NOT NULL,
    TO_DATE          DATE          NOT NULL,
    IS_HALF_DAY      BIT           NOT NULL CONSTRAINT DF_LV_HALF DEFAULT (0),
    HALF_DAY_SESSION TINYINT       NULL,
    TOTAL_DAYS       DECIMAL(5,2)  NOT NULL,
    REASON           VARCHAR(500)  NULL,
    STATUS_ID        INT           NOT NULL CONSTRAINT DF_LV_STATUS DEFAULT (1),
    APPROVED_BY      INT           NULL,
    APPROVED_DATE    DATETIME      NULL,
    REJECT_REASON    VARCHAR(500)  NULL,
    CANCELLED_BY     INT           NULL,
    CANCELLED_DATE   DATETIME      NULL,
    CREATED_BY       INT           NULL,
    CREATED_DATE     DATETIME      NOT NULL CONSTRAINT DF_LV_CREATED DEFAULT (GETDATE()),
    CHANGED_BY       INT           NULL,
    CHANGED_DATE     DATETIME      NULL,
    CONSTRAINT PK_EMPLOYEE_LEAVES PRIMARY KEY (ID),
    CONSTRAINT FK_LV_USER   FOREIGN KEY (USER_ID)       REFERENCES dbo.USERS(ID),
    CONSTRAINT FK_LV_TYPE   FOREIGN KEY (LEAVE_TYPE_ID) REFERENCES dbo.LEAVE_TYPES(ID),
    CONSTRAINT FK_LV_STATUS FOREIGN KEY (STATUS_ID)     REFERENCES dbo.LEAVE_STATUS(ID),
    CONSTRAINT CK_LV_DATES  CHECK (TO_DATE >= FROM_DATE),
    CONSTRAINT CK_LV_HALF   CHECK (IS_HALF_DAY = 0 OR FROM_DATE = TO_DATE)
);
GO

CREATE INDEX IX_LV_USER_STATUS ON dbo.EMPLOYEE_LEAVES (USER_ID, STATUS_ID);
CREATE INDEX IX_LV_DATES       ON dbo.EMPLOYEE_LEAVES (FROM_DATE, TO_DATE, STATUS_ID);
GO

/*---------------------------------------------------------------------------
  OPTIONAL_HOLIDAY_REQUESTS - employee opting into an optional holiday
---------------------------------------------------------------------------*/
CREATE TABLE dbo.OPTIONAL_HOLIDAY_REQUESTS
(
    ID             INT IDENTITY(1,1) NOT NULL,
    USER_ID        INT          NOT NULL,
    HOLIDAY_ID     INT          NOT NULL,
    STATUS_ID      INT          NOT NULL CONSTRAINT DF_OHR_STATUS DEFAULT (1),
    APPROVED_BY    INT          NULL,
    APPROVED_DATE  DATETIME     NULL,
    REJECT_REASON  VARCHAR(500) NULL,
    CREATED_BY     INT          NULL,
    CREATED_DATE   DATETIME     NOT NULL CONSTRAINT DF_OHR_CREATED DEFAULT (GETDATE()),
    CHANGED_BY     INT          NULL,
    CHANGED_DATE   DATETIME     NULL,
    CONSTRAINT PK_OPTIONAL_HOLIDAY_REQUESTS PRIMARY KEY (ID),
    CONSTRAINT UQ_OHR_USER_HOLIDAY UNIQUE (USER_ID, HOLIDAY_ID),
    CONSTRAINT FK_OHR_USER    FOREIGN KEY (USER_ID)    REFERENCES dbo.USERS(ID),
    CONSTRAINT FK_OHR_HOLIDAY FOREIGN KEY (HOLIDAY_ID) REFERENCES dbo.COMPANY_HOLIDAYS(ID),
    CONSTRAINT FK_OHR_STATUS  FOREIGN KEY (STATUS_ID)  REFERENCES dbo.LEAVE_STATUS(ID)
);
GO

/*---------------------------------------------------------------------------
  AUTO_EMAIL_NOTIFICATION - templates keyed by EmailNotificationType enum
---------------------------------------------------------------------------*/
CREATE TABLE dbo.AUTO_EMAIL_NOTIFICATION
(
    ID         INT           NOT NULL,
    CODE       VARCHAR(50)   NOT NULL,
    NAME       VARCHAR(100)  NOT NULL,
    TO_EMAIL   VARCHAR(500)  NULL,
    CC_EMAIL   VARCHAR(500)  NULL,
    BCC_EMAIL  VARCHAR(500)  NULL,
    SUBJECT    VARCHAR(300)  NOT NULL,
    BODY       NVARCHAR(MAX) NOT NULL,
    IS_ACTIVE  BIT           NOT NULL CONSTRAINT DF_AEN_ACTIVE DEFAULT (1),
    CONSTRAINT PK_AUTO_EMAIL_NOTIFICATION PRIMARY KEY (ID)
);
GO

PRINT 'HRM schema created.';
GO
