/*=============================================================================
  HRM PORTAL - FUNCTIONS & STORED PROCEDURES
  Run after 01_Schema.sql and 02_SeedData.sql
=============================================================================*/

USE HRM;
GO

/*=============================================================================
  HELPER FUNCTIONS
=============================================================================*/

IF OBJECT_ID('dbo.FN_IS_WORKING_DAY','FN') IS NOT NULL DROP FUNCTION dbo.FN_IS_WORKING_DAY;
GO
/* A working day is Mon-Fri and not an active, non-optional company holiday.
   DATEDIFF from 1900-01-01 (a Monday) makes this independent of DATEFIRST. */
CREATE FUNCTION dbo.FN_IS_WORKING_DAY (@DATE DATE)
RETURNS BIT
AS
BEGIN
    DECLARE @DOW INT = DATEDIFF(DAY, '19000101', @DATE) % 7;   -- 0=Mon .. 5=Sat, 6=Sun

    IF @DOW IN (5, 6)
        RETURN 0;

    IF EXISTS (SELECT 1
               FROM   dbo.COMPANY_HOLIDAYS
               WHERE  HOLIDAY_DATE = @DATE
               AND    IS_OPTIONAL  = 0
               AND    IS_ACTIVE    = 1)
        RETURN 0;

    RETURN 1;
END
GO

IF OBJECT_ID('dbo.FN_GET_WORKING_DAYS','FN') IS NOT NULL DROP FUNCTION dbo.FN_GET_WORKING_DAYS;
GO
CREATE FUNCTION dbo.FN_GET_WORKING_DAYS (@FROM_DATE DATE, @TO_DATE DATE)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @COUNT DECIMAL(5,2) = 0;
    DECLARE @CURRENT DATE = @FROM_DATE;

    WHILE @CURRENT <= @TO_DATE
    BEGIN
        IF dbo.FN_IS_WORKING_DAY(@CURRENT) = 1
            SET @COUNT = @COUNT + 1;

        SET @CURRENT = DATEADD(DAY, 1, @CURRENT);
    END

    RETURN @COUNT;
END
GO

/*=============================================================================
  AUTHENTICATION & USERS
=============================================================================*/

IF OBJECT_ID('dbo.SP_USER_LOGIN','P') IS NOT NULL DROP PROCEDURE dbo.SP_USER_LOGIN;
GO
/* Returns the stored hash; the API verifies it with PBKDF2 so the plaintext
   password never reaches SQL Server. */
CREATE PROCEDURE dbo.SP_USER_LOGIN
    @USERNAME VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  U.ID,
            U.USERNAME,
            U.PASSWORD_HASH,
            U.FIRST_NAME,
            U.LAST_NAME,
            U.EMAIL,
            U.EMPLOYEE_CODE,
            U.DESIGNATION,
            U.DEPARTMENT,
            U.IS_ADMIN,
            U.IS_ACTIVE
    FROM    dbo.USERS U
    WHERE   U.USERNAME = @USERNAME;
END
GO

IF OBJECT_ID('dbo.SP_GET_USERS','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_USERS;
GO
CREATE PROCEDURE dbo.SP_GET_USERS
    @INCLUDE_INACTIVE BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  U.ID,
            U.USERNAME,
            U.EMPLOYEE_CODE,
            U.FIRST_NAME,
            U.LAST_NAME,
            U.EMAIL,
            U.MOBILE_NO,
            U.CITY,
            U.DESIGNATION,
            U.DEPARTMENT,
            U.REPORTING_MANAGER_ID,
            M.FIRST_NAME + ' ' + M.LAST_NAME AS REPORTING_MANAGER_NAME,
            U.DATE_OF_BIRTH,
            U.JOINING_DATE,
            U.COMPANY_LEAVING_DATE,
            U.IS_ADMIN,
            U.IS_ACTIVE,
            U.CREATED_DATE
    FROM    dbo.USERS U
    LEFT JOIN dbo.USERS M ON M.ID = U.REPORTING_MANAGER_ID
    WHERE   (@INCLUDE_INACTIVE = 1 OR U.IS_ACTIVE = 1)
    ORDER BY U.FIRST_NAME, U.LAST_NAME;
END
GO

IF OBJECT_ID('dbo.SP_GET_USER_BY_ID','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_USER_BY_ID;
GO
CREATE PROCEDURE dbo.SP_GET_USER_BY_ID
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  U.ID,
            U.USERNAME,
            U.EMPLOYEE_CODE,
            U.FIRST_NAME,
            U.LAST_NAME,
            U.EMAIL,
            U.MOBILE_NO,
            U.CITY,
            U.DESIGNATION,
            U.DEPARTMENT,
            U.REPORTING_MANAGER_ID,
            M.FIRST_NAME + ' ' + M.LAST_NAME AS REPORTING_MANAGER_NAME,
            U.DATE_OF_BIRTH,
            U.JOINING_DATE,
            U.COMPANY_LEAVING_DATE,
            U.IS_ADMIN,
            U.IS_ACTIVE,
            U.CREATED_DATE
    FROM    dbo.USERS U
    LEFT JOIN dbo.USERS M ON M.ID = U.REPORTING_MANAGER_ID
    WHERE   U.ID = @ID;
END
GO

IF OBJECT_ID('dbo.SP_CREATE_USER','P') IS NOT NULL DROP PROCEDURE dbo.SP_CREATE_USER;
GO
/* Returns new ID, or -1 username taken, -2 email taken. */
CREATE PROCEDURE dbo.SP_CREATE_USER
    @USERNAME             VARCHAR(100),
    @PASSWORD_HASH        VARCHAR(255),
    @EMPLOYEE_CODE        VARCHAR(20)  = NULL,
    @FIRST_NAME           VARCHAR(100),
    @LAST_NAME            VARCHAR(100),
    @EMAIL                VARCHAR(150),
    @MOBILE_NO            VARCHAR(20)  = NULL,
    @CITY                 VARCHAR(100) = NULL,
    @DESIGNATION          VARCHAR(100) = NULL,
    @DEPARTMENT           VARCHAR(100) = NULL,
    @REPORTING_MANAGER_ID INT          = NULL,
    @DATE_OF_BIRTH        DATE         = NULL,
    @JOINING_DATE         DATE,
    @COMPANY_LEAVING_DATE DATE         = NULL,
    @IS_ADMIN             BIT          = 0,
    @IS_ACTIVE            BIT          = 1,
    @CREATED_BY           INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.USERS WHERE USERNAME = @USERNAME)
    BEGIN
        SELECT -1;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.USERS WHERE EMAIL = @EMAIL)
    BEGIN
        SELECT -2;
        RETURN;
    END

    INSERT INTO dbo.USERS
        (USERNAME, PASSWORD_HASH, EMPLOYEE_CODE, FIRST_NAME, LAST_NAME, EMAIL,
         MOBILE_NO, CITY, DESIGNATION, DEPARTMENT, REPORTING_MANAGER_ID,
         DATE_OF_BIRTH, JOINING_DATE, COMPANY_LEAVING_DATE,
         IS_ADMIN, IS_ACTIVE, CREATED_BY)
    VALUES
        (@USERNAME, @PASSWORD_HASH, @EMPLOYEE_CODE, @FIRST_NAME, @LAST_NAME, @EMAIL,
         @MOBILE_NO, @CITY, @DESIGNATION, @DEPARTMENT, @REPORTING_MANAGER_ID,
         @DATE_OF_BIRTH, @JOINING_DATE, @COMPANY_LEAVING_DATE,
         @IS_ADMIN, @IS_ACTIVE, @CREATED_BY);

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO

IF OBJECT_ID('dbo.SP_UPDATE_USER','P') IS NOT NULL DROP PROCEDURE dbo.SP_UPDATE_USER;
GO
/* Returns ID, or -1 not found, -2 email used by another user. */
CREATE PROCEDURE dbo.SP_UPDATE_USER
    @ID                   INT,
    @EMPLOYEE_CODE        VARCHAR(20)  = NULL,
    @FIRST_NAME           VARCHAR(100),
    @LAST_NAME            VARCHAR(100),
    @EMAIL                VARCHAR(150),
    @MOBILE_NO            VARCHAR(20)  = NULL,
    @CITY                 VARCHAR(100) = NULL,
    @DESIGNATION          VARCHAR(100) = NULL,
    @DEPARTMENT           VARCHAR(100) = NULL,
    @REPORTING_MANAGER_ID INT          = NULL,
    @DATE_OF_BIRTH        DATE         = NULL,
    @JOINING_DATE         DATE,
    @COMPANY_LEAVING_DATE DATE         = NULL,
    @IS_ADMIN             BIT,
    @IS_ACTIVE            BIT,
    @CHANGED_BY           INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.USERS WHERE ID = @ID)
    BEGIN
        SELECT -1;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.USERS WHERE EMAIL = @EMAIL AND ID <> @ID)
    BEGIN
        SELECT -2;
        RETURN;
    END

    UPDATE dbo.USERS
    SET    EMPLOYEE_CODE        = @EMPLOYEE_CODE,
           FIRST_NAME           = @FIRST_NAME,
           LAST_NAME            = @LAST_NAME,
           EMAIL                = @EMAIL,
           MOBILE_NO            = @MOBILE_NO,
           CITY                 = @CITY,
           DESIGNATION          = @DESIGNATION,
           DEPARTMENT           = @DEPARTMENT,
           REPORTING_MANAGER_ID = @REPORTING_MANAGER_ID,
           DATE_OF_BIRTH        = @DATE_OF_BIRTH,
           JOINING_DATE         = @JOINING_DATE,
           COMPANY_LEAVING_DATE = @COMPANY_LEAVING_DATE,
           IS_ADMIN             = @IS_ADMIN,
           IS_ACTIVE            = @IS_ACTIVE,
           CHANGED_BY           = @CHANGED_BY,
           CHANGED_DATE         = GETDATE()
    WHERE  ID = @ID;

    SELECT @ID;
END
GO

IF OBJECT_ID('dbo.SP_DELETE_USER','P') IS NOT NULL DROP PROCEDURE dbo.SP_DELETE_USER;
GO
/* Soft delete. Returns ID, or -1 not found / already inactive. */
CREATE PROCEDURE dbo.SP_DELETE_USER
    @ID         INT,
    @CHANGED_BY INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.USERS WHERE ID = @ID AND IS_ACTIVE = 1)
    BEGIN
        SELECT -1;
        RETURN;
    END

    UPDATE dbo.USERS
    SET    IS_ACTIVE    = 0,
           CHANGED_BY   = @CHANGED_BY,
           CHANGED_DATE = GETDATE()
    WHERE  ID = @ID;

    SELECT @ID;
END
GO

IF OBJECT_ID('dbo.SP_CHANGE_PASSWORD','P') IS NOT NULL DROP PROCEDURE dbo.SP_CHANGE_PASSWORD;
GO
CREATE PROCEDURE dbo.SP_CHANGE_PASSWORD
    @ID            INT,
    @PASSWORD_HASH VARCHAR(255),
    @CHANGED_BY    INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.USERS WHERE ID = @ID AND IS_ACTIVE = 1)
    BEGIN
        SELECT -1;
        RETURN;
    END

    UPDATE dbo.USERS
    SET    PASSWORD_HASH = @PASSWORD_HASH,
           CHANGED_BY    = @CHANGED_BY,
           CHANGED_DATE  = GETDATE()
    WHERE  ID = @ID;

    SELECT @ID;
END
GO

/*=============================================================================
  LEAVE TYPES & ALLOCATION
=============================================================================*/

IF OBJECT_ID('dbo.SP_GET_LEAVE_TYPES','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_LEAVE_TYPES;
GO
CREATE PROCEDURE dbo.SP_GET_LEAVE_TYPES
    @APPLICABLE_ONLY BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  ID,
            CODE,
            NAME,
            DEFAULT_ENTITLEMENT,
            IS_PAID,
            ALLOW_HALF_DAY,
            IS_BALANCE_TRACKED,
            IS_APPLICABLE,
            COLOR_CODE,
            DISPLAY_ORDER,
            IS_ACTIVE
    FROM    dbo.LEAVE_TYPES
    WHERE   IS_ACTIVE = 1
    AND     (@APPLICABLE_ONLY = 0 OR IS_APPLICABLE = 1)
    ORDER BY DISPLAY_ORDER;
END
GO

IF OBJECT_ID('dbo.SP_ALLOCATE_EMPLOYEE_LEAVE','P') IS NOT NULL DROP PROCEDURE dbo.SP_ALLOCATE_EMPLOYEE_LEAVE;
GO
/* Creates the yearly balance rows for an employee.
   With @LEAVE_TYPE_ID + @ENTITLEMENT it overrides a single type instead.
   Entitlement is pro-rated for employees who joined during the year. */
CREATE PROCEDURE dbo.SP_ALLOCATE_EMPLOYEE_LEAVE
    @USER_ID       INT,
    @YEAR          INT,
    @CREATED_BY    INT,
    @LEAVE_TYPE_ID INT          = NULL,
    @ENTITLEMENT   DECIMAL(5,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.USERS WHERE ID = @USER_ID)
    BEGIN
        SELECT -1;
        RETURN;
    END

    /* Single-type override */
    IF @LEAVE_TYPE_ID IS NOT NULL AND @ENTITLEMENT IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.EMPLOYEE_LEAVE_BALANCE
                   WHERE USER_ID = @USER_ID AND LEAVE_TYPE_ID = @LEAVE_TYPE_ID AND [YEAR] = @YEAR)
        BEGIN
            UPDATE dbo.EMPLOYEE_LEAVE_BALANCE
            SET    ENTITLEMENT  = @ENTITLEMENT,
                   CHANGED_BY   = @CREATED_BY,
                   CHANGED_DATE = GETDATE()
            WHERE  USER_ID = @USER_ID AND LEAVE_TYPE_ID = @LEAVE_TYPE_ID AND [YEAR] = @YEAR;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.EMPLOYEE_LEAVE_BALANCE
                (USER_ID, LEAVE_TYPE_ID, [YEAR], ENTITLEMENT, USED, CREATED_BY)
            VALUES
                (@USER_ID, @LEAVE_TYPE_ID, @YEAR, @ENTITLEMENT, 0, @CREATED_BY);
        END

        SELECT @USER_ID;
        RETURN;
    END

    /* Full allocation for every balance-tracked type, pro-rated on joining month */
    DECLARE @JOINING_DATE DATE = (SELECT JOINING_DATE FROM dbo.USERS WHERE ID = @USER_ID);
    DECLARE @MONTHS_ACTIVE INT =
        CASE WHEN YEAR(@JOINING_DATE) = @YEAR
             THEN 12 - MONTH(@JOINING_DATE) + 1
             ELSE 12
        END;

    INSERT INTO dbo.EMPLOYEE_LEAVE_BALANCE
        (USER_ID, LEAVE_TYPE_ID, [YEAR], ENTITLEMENT, USED, CREATED_BY)
    SELECT  @USER_ID,
            LT.ID,
            @YEAR,
            CAST(ROUND(LT.DEFAULT_ENTITLEMENT * @MONTHS_ACTIVE / 12.0, 1) AS DECIMAL(5,2)),
            0,
            @CREATED_BY
    FROM    dbo.LEAVE_TYPES LT
    WHERE   LT.IS_ACTIVE          = 1
    AND     LT.IS_BALANCE_TRACKED = 1
    AND     NOT EXISTS (SELECT 1
                        FROM   dbo.EMPLOYEE_LEAVE_BALANCE B
                        WHERE  B.USER_ID       = @USER_ID
                        AND    B.LEAVE_TYPE_ID = LT.ID
                        AND    B.[YEAR]        = @YEAR);

    SELECT @USER_ID;
END
GO

IF OBJECT_ID('dbo.SP_GET_EMPLOYEE_LEAVE_BALANCE','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_EMPLOYEE_LEAVE_BALANCE;
GO
/* PENDING = days awaiting approval. REMAINING = ENTITLEMENT - USED - PENDING. */
CREATE PROCEDURE dbo.SP_GET_EMPLOYEE_LEAVE_BALANCE
    @USER_ID INT,
    @YEAR    INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  LT.ID                              AS LEAVE_TYPE_ID,
            LT.NAME                            AS LEAVE_TYPE_NAME,
            LT.CODE                            AS LEAVE_TYPE_CODE,
            LT.COLOR_CODE,
            LT.IS_BALANCE_TRACKED,
            ISNULL(B.ENTITLEMENT, 0)           AS ENTITLEMENT,
            ISNULL(B.USED, 0)                  AS USED,
            ISNULL(P.PENDING_DAYS, 0)          AS PENDING,
            ISNULL(B.ENTITLEMENT, 0)
              - ISNULL(B.USED, 0)
              - ISNULL(P.PENDING_DAYS, 0)      AS REMAINING
    FROM    dbo.LEAVE_TYPES LT
    LEFT JOIN dbo.EMPLOYEE_LEAVE_BALANCE B
           ON B.LEAVE_TYPE_ID = LT.ID
          AND B.USER_ID       = @USER_ID
          AND B.[YEAR]        = @YEAR
    OUTER APPLY (
        SELECT SUM(L.TOTAL_DAYS) AS PENDING_DAYS
        FROM   dbo.EMPLOYEE_LEAVES L
        WHERE  L.USER_ID       = @USER_ID
        AND    L.LEAVE_TYPE_ID = LT.ID
        AND    L.STATUS_ID     = 1
        AND    YEAR(L.FROM_DATE) = @YEAR
    ) P
    WHERE   LT.IS_ACTIVE     = 1
    AND     LT.IS_APPLICABLE = 1
    ORDER BY LT.DISPLAY_ORDER;
END
GO

/*=============================================================================
  LEAVE APPLICATION
=============================================================================*/

IF OBJECT_ID('dbo.SP_APPLY_EMPLOYEE_LEAVE','P') IS NOT NULL DROP PROCEDURE dbo.SP_APPLY_EMPLOYEE_LEAVE;
GO
/*  Returns the new leave ID, or:
    -1 from date after to date          -2 leave crosses calendar years
    -3 half day spans multiple dates     -4 no balance row for this year
    -5 overlaps an existing leave        -6 range contains no working days
    -7 insufficient balance              -8 leave type not applicable
    -9 leave type does not allow half days                                  */
CREATE PROCEDURE dbo.SP_APPLY_EMPLOYEE_LEAVE
    @USER_ID          INT,
    @LEAVE_TYPE_ID    INT,
    @FROM_DATE        DATE,
    @TO_DATE          DATE,
    @IS_HALF_DAY      BIT,
    @HALF_DAY_SESSION TINYINT = NULL,
    @REASON           VARCHAR(500),
    @CREATED_BY       INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @FROM_DATE > @TO_DATE
    BEGIN
        SELECT -1;
        RETURN;
    END

    IF YEAR(@FROM_DATE) <> YEAR(@TO_DATE)
    BEGIN
        SELECT -2;
        RETURN;
    END

    IF @IS_HALF_DAY = 1 AND @FROM_DATE <> @TO_DATE
    BEGIN
        SELECT -3;
        RETURN;
    END

    DECLARE @IS_APPLICABLE      BIT,
            @ALLOW_HALF_DAY     BIT,
            @IS_BALANCE_TRACKED BIT;

    SELECT  @IS_APPLICABLE      = IS_APPLICABLE,
            @ALLOW_HALF_DAY     = ALLOW_HALF_DAY,
            @IS_BALANCE_TRACKED = IS_BALANCE_TRACKED
    FROM    dbo.LEAVE_TYPES
    WHERE   ID = @LEAVE_TYPE_ID AND IS_ACTIVE = 1;

    IF @IS_APPLICABLE IS NULL OR @IS_APPLICABLE = 0
    BEGIN
        SELECT -8;
        RETURN;
    END

    IF @IS_HALF_DAY = 1 AND @ALLOW_HALF_DAY = 0
    BEGIN
        SELECT -9;
        RETURN;
    END

    /* Overlap against anything pending or approved */
    IF EXISTS (SELECT 1
               FROM   dbo.EMPLOYEE_LEAVES L
               WHERE  L.USER_ID   = @USER_ID
               AND    L.STATUS_ID IN (1, 2)
               AND    L.FROM_DATE <= @TO_DATE
               AND    L.TO_DATE   >= @FROM_DATE)
    BEGIN
        SELECT -5;
        RETURN;
    END

    DECLARE @TOTAL_DAYS DECIMAL(5,2) = dbo.FN_GET_WORKING_DAYS(@FROM_DATE, @TO_DATE);

    IF @TOTAL_DAYS = 0
    BEGIN
        SELECT -6;
        RETURN;
    END

    IF @IS_HALF_DAY = 1
        SET @TOTAL_DAYS = 0.5;

    /* Balance check only for tracked types (WFH / Management are unlimited) */
    IF @IS_BALANCE_TRACKED = 1
    BEGIN
        DECLARE @YEAR        INT = YEAR(@FROM_DATE);
        DECLARE @ENTITLEMENT DECIMAL(5,2);
        DECLARE @USED        DECIMAL(5,2);

        SELECT  @ENTITLEMENT = ENTITLEMENT,
                @USED        = USED
        FROM    dbo.EMPLOYEE_LEAVE_BALANCE
        WHERE   USER_ID = @USER_ID AND LEAVE_TYPE_ID = @LEAVE_TYPE_ID AND [YEAR] = @YEAR;

        IF @ENTITLEMENT IS NULL
        BEGIN
            SELECT -4;
            RETURN;
        END

        DECLARE @PENDING DECIMAL(5,2) =
            ISNULL((SELECT SUM(TOTAL_DAYS)
                    FROM   dbo.EMPLOYEE_LEAVES
                    WHERE  USER_ID       = @USER_ID
                    AND    LEAVE_TYPE_ID = @LEAVE_TYPE_ID
                    AND    STATUS_ID     = 1
                    AND    YEAR(FROM_DATE) = @YEAR), 0);

        IF (@ENTITLEMENT - @USED - @PENDING) < @TOTAL_DAYS
        BEGIN
            SELECT -7;
            RETURN;
        END
    END

    INSERT INTO dbo.EMPLOYEE_LEAVES
        (USER_ID, LEAVE_TYPE_ID, FROM_DATE, TO_DATE, IS_HALF_DAY,
         HALF_DAY_SESSION, TOTAL_DAYS, REASON, STATUS_ID, CREATED_BY)
    VALUES
        (@USER_ID, @LEAVE_TYPE_ID, @FROM_DATE, @TO_DATE, @IS_HALF_DAY,
         CASE WHEN @IS_HALF_DAY = 1 THEN ISNULL(@HALF_DAY_SESSION, 1) ELSE NULL END,
         @TOTAL_DAYS, @REASON, 1, @CREATED_BY);

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO

IF OBJECT_ID('dbo.SP_UPDATE_EMPLOYEE_LEAVE_STATUS','P') IS NOT NULL DROP PROCEDURE dbo.SP_UPDATE_EMPLOYEE_LEAVE_STATUS;
GO
/*  Approve (2) or reject (3) a pending leave.
    Returns leave ID, or -1 not found / not pending, -2 no balance row,
    -3 insufficient balance, -4 invalid status.                             */
CREATE PROCEDURE dbo.SP_UPDATE_EMPLOYEE_LEAVE_STATUS
    @ID            INT,
    @STATUS_ID     INT,
    @CHANGED_BY    INT,
    @REJECT_REASON VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @STATUS_ID NOT IN (2, 3)
    BEGIN
        SELECT -4;
        RETURN;
    END

    DECLARE @USER_ID       INT,
            @LEAVE_TYPE_ID INT,
            @TOTAL_DAYS    DECIMAL(5,2),
            @FROM_DATE     DATE;

    SELECT  @USER_ID       = USER_ID,
            @LEAVE_TYPE_ID = LEAVE_TYPE_ID,
            @TOTAL_DAYS    = TOTAL_DAYS,
            @FROM_DATE     = FROM_DATE
    FROM    dbo.EMPLOYEE_LEAVES
    WHERE   ID = @ID AND STATUS_ID = 1;

    IF @USER_ID IS NULL
    BEGIN
        SELECT -1;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @STATUS_ID = 2
        BEGIN
            DECLARE @IS_TRACKED BIT =
                (SELECT IS_BALANCE_TRACKED FROM dbo.LEAVE_TYPES WHERE ID = @LEAVE_TYPE_ID);

            IF @IS_TRACKED = 1
            BEGIN
                DECLARE @YEAR INT = YEAR(@FROM_DATE);
                DECLARE @ENTITLEMENT DECIMAL(5,2);
                DECLARE @USED        DECIMAL(5,2);

                SELECT  @ENTITLEMENT = ENTITLEMENT,
                        @USED        = USED
                FROM    dbo.EMPLOYEE_LEAVE_BALANCE
                WHERE   USER_ID = @USER_ID AND LEAVE_TYPE_ID = @LEAVE_TYPE_ID AND [YEAR] = @YEAR;

                IF @ENTITLEMENT IS NULL
                BEGIN
                    ROLLBACK TRANSACTION;
                    SELECT -2;
                    RETURN;
                END

                IF (@ENTITLEMENT - @USED) < @TOTAL_DAYS
                BEGIN
                    ROLLBACK TRANSACTION;
                    SELECT -3;
                    RETURN;
                END

                UPDATE dbo.EMPLOYEE_LEAVE_BALANCE
                SET    USED         = USED + @TOTAL_DAYS,
                       CHANGED_BY   = @CHANGED_BY,
                       CHANGED_DATE = GETDATE()
                WHERE  USER_ID = @USER_ID AND LEAVE_TYPE_ID = @LEAVE_TYPE_ID AND [YEAR] = @YEAR;
            END
        END

        UPDATE dbo.EMPLOYEE_LEAVES
        SET    STATUS_ID     = @STATUS_ID,
               APPROVED_BY   = @CHANGED_BY,
               APPROVED_DATE = GETDATE(),
               REJECT_REASON = CASE WHEN @STATUS_ID = 3 THEN @REJECT_REASON ELSE NULL END,
               CHANGED_BY    = @CHANGED_BY,
               CHANGED_DATE  = GETDATE()
        WHERE  ID = @ID;

        COMMIT TRANSACTION;

        SELECT @ID;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

IF OBJECT_ID('dbo.SP_CANCEL_EMPLOYEE_LEAVE','P') IS NOT NULL DROP PROCEDURE dbo.SP_CANCEL_EMPLOYEE_LEAVE;
GO
/*  Cancels a pending or approved leave and credits the balance back when the
    leave had already been approved.
    Returns leave ID, or -1 not found / not cancellable, -2 no balance row.  */
CREATE PROCEDURE dbo.SP_CANCEL_EMPLOYEE_LEAVE
    @ID           INT,
    @CANCELLED_BY INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @USER_ID       INT,
            @LEAVE_TYPE_ID INT,
            @TOTAL_DAYS    DECIMAL(5,2),
            @FROM_DATE     DATE,
            @STATUS_ID     INT;

    SELECT  @USER_ID       = USER_ID,
            @LEAVE_TYPE_ID = LEAVE_TYPE_ID,
            @TOTAL_DAYS    = TOTAL_DAYS,
            @FROM_DATE     = FROM_DATE,
            @STATUS_ID     = STATUS_ID
    FROM    dbo.EMPLOYEE_LEAVES
    WHERE   ID = @ID AND STATUS_ID IN (1, 2);

    IF @USER_ID IS NULL
    BEGIN
        SELECT -1;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        /* Only an approved leave has consumed balance */
        IF @STATUS_ID = 2
        BEGIN
            DECLARE @IS_TRACKED BIT =
                (SELECT IS_BALANCE_TRACKED FROM dbo.LEAVE_TYPES WHERE ID = @LEAVE_TYPE_ID);

            IF @IS_TRACKED = 1
            BEGIN
                DECLARE @YEAR INT = YEAR(@FROM_DATE);

                IF NOT EXISTS (SELECT 1 FROM dbo.EMPLOYEE_LEAVE_BALANCE
                               WHERE USER_ID = @USER_ID AND LEAVE_TYPE_ID = @LEAVE_TYPE_ID AND [YEAR] = @YEAR)
                BEGIN
                    ROLLBACK TRANSACTION;
                    SELECT -2;
                    RETURN;
                END

                UPDATE dbo.EMPLOYEE_LEAVE_BALANCE
                SET    USED         = CASE WHEN USED - @TOTAL_DAYS < 0 THEN 0 ELSE USED - @TOTAL_DAYS END,
                       CHANGED_BY   = @CANCELLED_BY,
                       CHANGED_DATE = GETDATE()
                WHERE  USER_ID = @USER_ID AND LEAVE_TYPE_ID = @LEAVE_TYPE_ID AND [YEAR] = @YEAR;
            END
        END

        UPDATE dbo.EMPLOYEE_LEAVES
        SET    STATUS_ID      = 4,
               CANCELLED_BY   = @CANCELLED_BY,
               CANCELLED_DATE = GETDATE(),
               CHANGED_BY     = @CANCELLED_BY,
               CHANGED_DATE   = GETDATE()
        WHERE  ID = @ID;

        COMMIT TRANSACTION;

        SELECT @ID;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

IF OBJECT_ID('dbo.SP_GET_EMPLOYEE_LEAVES','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_EMPLOYEE_LEAVES;
GO
CREATE PROCEDURE dbo.SP_GET_EMPLOYEE_LEAVES
    @USER_ID   INT  = NULL,
    @STATUS_ID INT  = NULL,
    @FROM_DATE DATE = NULL,
    @TO_DATE   DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  L.ID,
            L.USER_ID,
            U.FIRST_NAME + ' ' + U.LAST_NAME AS EMPLOYEE_NAME,
            U.EMPLOYEE_CODE,
            L.LEAVE_TYPE_ID,
            LT.NAME       AS LEAVE_TYPE_NAME,
            LT.COLOR_CODE,
            L.FROM_DATE,
            L.TO_DATE,
            L.IS_HALF_DAY,
            L.HALF_DAY_SESSION,
            L.TOTAL_DAYS,
            L.REASON,
            L.STATUS_ID,
            S.NAME        AS STATUS_NAME,
            L.APPROVED_BY,
            A.FIRST_NAME + ' ' + A.LAST_NAME AS APPROVED_BY_NAME,
            L.APPROVED_DATE,
            L.REJECT_REASON,
            L.CANCELLED_BY,
            L.CANCELLED_DATE,
            L.CREATED_DATE
    FROM    dbo.EMPLOYEE_LEAVES L
    INNER JOIN dbo.USERS        U  ON U.ID  = L.USER_ID
    INNER JOIN dbo.LEAVE_TYPES  LT ON LT.ID = L.LEAVE_TYPE_ID
    INNER JOIN dbo.LEAVE_STATUS S  ON S.ID  = L.STATUS_ID
    LEFT  JOIN dbo.USERS        A  ON A.ID  = L.APPROVED_BY
    WHERE   (@USER_ID   IS NULL OR L.USER_ID   = @USER_ID)
    AND     (@STATUS_ID IS NULL OR L.STATUS_ID = @STATUS_ID)
    AND     (@FROM_DATE IS NULL OR L.TO_DATE  >= @FROM_DATE)
    AND     (@TO_DATE   IS NULL OR L.FROM_DATE <= @TO_DATE)
    ORDER BY L.CREATED_DATE DESC;
END
GO

IF OBJECT_ID('dbo.SP_GET_EMPLOYEE_LEAVE_BY_ID','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_EMPLOYEE_LEAVE_BY_ID;
GO
/* Single leave row - used for ownership checks and notification payloads. */
CREATE PROCEDURE dbo.SP_GET_EMPLOYEE_LEAVE_BY_ID
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  L.ID,
            L.USER_ID,
            U.FIRST_NAME + ' ' + U.LAST_NAME AS EMPLOYEE_NAME,
            U.EMPLOYEE_CODE,
            U.EMAIL                          AS EMPLOYEE_EMAIL,
            L.LEAVE_TYPE_ID,
            LT.NAME       AS LEAVE_TYPE_NAME,
            LT.COLOR_CODE,
            L.FROM_DATE,
            L.TO_DATE,
            L.IS_HALF_DAY,
            L.HALF_DAY_SESSION,
            L.TOTAL_DAYS,
            L.REASON,
            L.STATUS_ID,
            S.NAME        AS STATUS_NAME,
            L.APPROVED_BY,
            A.FIRST_NAME + ' ' + A.LAST_NAME AS APPROVED_BY_NAME,
            L.APPROVED_DATE,
            L.REJECT_REASON,
            L.CANCELLED_BY,
            L.CANCELLED_DATE,
            L.CREATED_DATE
    FROM    dbo.EMPLOYEE_LEAVES L
    INNER JOIN dbo.USERS        U  ON U.ID  = L.USER_ID
    INNER JOIN dbo.LEAVE_TYPES  LT ON LT.ID = L.LEAVE_TYPE_ID
    INNER JOIN dbo.LEAVE_STATUS S  ON S.ID  = L.STATUS_ID
    LEFT  JOIN dbo.USERS        A  ON A.ID  = L.APPROVED_BY
    WHERE   L.ID = @ID;
END
GO

/*=============================================================================
  COMPANY HOLIDAYS
=============================================================================*/

IF OBJECT_ID('dbo.SP_CREATE_COMPANY_HOLIDAY','P') IS NOT NULL DROP PROCEDURE dbo.SP_CREATE_COMPANY_HOLIDAY;
GO
/* Returns new ID, or -1 duplicate date. */
CREATE PROCEDURE dbo.SP_CREATE_COMPANY_HOLIDAY
    @HOLIDAY_DATE  DATE,
    @LEAVE_TYPE_ID INT,
    @NAME          VARCHAR(150),
    @IS_OPTIONAL   BIT = 0,
    @CREATED_BY    INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.COMPANY_HOLIDAYS
               WHERE HOLIDAY_DATE = @HOLIDAY_DATE AND NAME = @NAME AND IS_ACTIVE = 1)
    BEGIN
        SELECT -1;
        RETURN;
    END

    INSERT INTO dbo.COMPANY_HOLIDAYS
        (HOLIDAY_DATE, LEAVE_TYPE_ID, NAME, IS_OPTIONAL, IS_ACTIVE, CREATED_BY)
    VALUES
        (@HOLIDAY_DATE, @LEAVE_TYPE_ID, @NAME, @IS_OPTIONAL, 1, @CREATED_BY);

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO

IF OBJECT_ID('dbo.SP_GET_COMPANY_HOLIDAYS','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_COMPANY_HOLIDAYS;
GO
CREATE PROCEDURE dbo.SP_GET_COMPANY_HOLIDAYS
    @YEAR        INT = NULL,
    @IS_OPTIONAL BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  H.ID,
            H.HOLIDAY_DATE,
            H.LEAVE_TYPE_ID,
            LT.NAME AS LEAVE_TYPE_NAME,
            H.NAME,
            H.IS_OPTIONAL,
            H.IS_ACTIVE
    FROM    dbo.COMPANY_HOLIDAYS H
    INNER JOIN dbo.LEAVE_TYPES LT ON LT.ID = H.LEAVE_TYPE_ID
    WHERE   H.IS_ACTIVE = 1
    AND     (@YEAR        IS NULL OR YEAR(H.HOLIDAY_DATE) = @YEAR)
    AND     (@IS_OPTIONAL IS NULL OR H.IS_OPTIONAL        = @IS_OPTIONAL)
    ORDER BY H.HOLIDAY_DATE;
END
GO

IF OBJECT_ID('dbo.SP_DELETE_COMPANY_HOLIDAY','P') IS NOT NULL DROP PROCEDURE dbo.SP_DELETE_COMPANY_HOLIDAY;
GO
CREATE PROCEDURE dbo.SP_DELETE_COMPANY_HOLIDAY
    @ID         INT,
    @CHANGED_BY INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.COMPANY_HOLIDAYS WHERE ID = @ID AND IS_ACTIVE = 1)
    BEGIN
        SELECT -1;
        RETURN;
    END

    UPDATE dbo.COMPANY_HOLIDAYS
    SET    IS_ACTIVE    = 0,
           CHANGED_BY   = @CHANGED_BY,
           CHANGED_DATE = GETDATE()
    WHERE  ID = @ID;

    SELECT @ID;
END
GO

/*=============================================================================
  OPTIONAL (FLOATER) HOLIDAYS
=============================================================================*/

IF OBJECT_ID('dbo.SP_APPLY_OPTIONAL_HOLIDAY','P') IS NOT NULL DROP PROCEDURE dbo.SP_APPLY_OPTIONAL_HOLIDAY;
GO
/*  Returns new request ID, or -1 holiday not found / not optional,
    -2 already applied, -3 holiday is in the past, -4 floater quota exhausted. */
CREATE PROCEDURE dbo.SP_APPLY_OPTIONAL_HOLIDAY
    @USER_ID    INT,
    @HOLIDAY_ID INT,
    @CREATED_BY INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HOLIDAY_DATE DATE;

    SELECT  @HOLIDAY_DATE = HOLIDAY_DATE
    FROM    dbo.COMPANY_HOLIDAYS
    WHERE   ID = @HOLIDAY_ID AND IS_OPTIONAL = 1 AND IS_ACTIVE = 1;

    IF @HOLIDAY_DATE IS NULL
    BEGIN
        SELECT -1;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.OPTIONAL_HOLIDAY_REQUESTS
               WHERE USER_ID = @USER_ID AND HOLIDAY_ID = @HOLIDAY_ID AND STATUS_ID IN (1, 2))
    BEGIN
        SELECT -2;
        RETURN;
    END

    IF @HOLIDAY_DATE < CAST(GETDATE() AS DATE)
    BEGIN
        SELECT -3;
        RETURN;
    END

    /* Quota comes from the Floater Leave (FL) entitlement for that year */
    DECLARE @YEAR INT = YEAR(@HOLIDAY_DATE);
    DECLARE @FL_TYPE_ID INT = (SELECT ID FROM dbo.LEAVE_TYPES WHERE CODE = 'FL');
    DECLARE @ALLOWED DECIMAL(5,2) =
        ISNULL((SELECT ENTITLEMENT FROM dbo.EMPLOYEE_LEAVE_BALANCE
                WHERE USER_ID = @USER_ID AND LEAVE_TYPE_ID = @FL_TYPE_ID AND [YEAR] = @YEAR), 0);

    DECLARE @TAKEN INT =
        (SELECT COUNT(*)
         FROM   dbo.OPTIONAL_HOLIDAY_REQUESTS R
         INNER JOIN dbo.COMPANY_HOLIDAYS H ON H.ID = R.HOLIDAY_ID
         WHERE  R.USER_ID = @USER_ID
         AND    R.STATUS_ID IN (1, 2)
         AND    YEAR(H.HOLIDAY_DATE) = @YEAR);

    IF @TAKEN >= @ALLOWED
    BEGIN
        SELECT -4;
        RETURN;
    END

    INSERT INTO dbo.OPTIONAL_HOLIDAY_REQUESTS
        (USER_ID, HOLIDAY_ID, STATUS_ID, CREATED_BY)
    VALUES
        (@USER_ID, @HOLIDAY_ID, 1, @CREATED_BY);

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO

IF OBJECT_ID('dbo.SP_GET_OPTIONAL_HOLIDAY_REQUESTS','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_OPTIONAL_HOLIDAY_REQUESTS;
GO
CREATE PROCEDURE dbo.SP_GET_OPTIONAL_HOLIDAY_REQUESTS
    @USER_ID   INT = NULL,
    @STATUS_ID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  R.ID,
            R.USER_ID,
            U.FIRST_NAME + ' ' + U.LAST_NAME AS EMPLOYEE_NAME,
            R.HOLIDAY_ID,
            H.NAME         AS HOLIDAY_NAME,
            H.HOLIDAY_DATE,
            R.STATUS_ID,
            S.NAME         AS STATUS_NAME,
            R.APPROVED_BY,
            A.FIRST_NAME + ' ' + A.LAST_NAME AS APPROVED_BY_NAME,
            R.APPROVED_DATE,
            R.REJECT_REASON,
            R.CREATED_DATE
    FROM    dbo.OPTIONAL_HOLIDAY_REQUESTS R
    INNER JOIN dbo.USERS            U ON U.ID = R.USER_ID
    INNER JOIN dbo.COMPANY_HOLIDAYS H ON H.ID = R.HOLIDAY_ID
    INNER JOIN dbo.LEAVE_STATUS     S ON S.ID = R.STATUS_ID
    LEFT  JOIN dbo.USERS            A ON A.ID = R.APPROVED_BY
    WHERE   (@USER_ID   IS NULL OR R.USER_ID   = @USER_ID)
    AND     (@STATUS_ID IS NULL OR R.STATUS_ID = @STATUS_ID)
    ORDER BY H.HOLIDAY_DATE DESC;
END
GO

IF OBJECT_ID('dbo.SP_UPDATE_OPTIONAL_HOLIDAY_STATUS','P') IS NOT NULL DROP PROCEDURE dbo.SP_UPDATE_OPTIONAL_HOLIDAY_STATUS;
GO
/* Approve (2), reject (3) or cancel (4). Returns ID, -1 not found, -4 bad status. */
CREATE PROCEDURE dbo.SP_UPDATE_OPTIONAL_HOLIDAY_STATUS
    @ID            INT,
    @STATUS_ID     INT,
    @CHANGED_BY    INT,
    @REJECT_REASON VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @STATUS_ID NOT IN (2, 3, 4)
    BEGIN
        SELECT -4;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.OPTIONAL_HOLIDAY_REQUESTS
                   WHERE ID = @ID AND STATUS_ID IN (1, 2))
    BEGIN
        SELECT -1;
        RETURN;
    END

    UPDATE dbo.OPTIONAL_HOLIDAY_REQUESTS
    SET    STATUS_ID     = @STATUS_ID,
           APPROVED_BY   = @CHANGED_BY,
           APPROVED_DATE = GETDATE(),
           REJECT_REASON = CASE WHEN @STATUS_ID = 3 THEN @REJECT_REASON ELSE NULL END,
           CHANGED_BY    = @CHANGED_BY,
           CHANGED_DATE  = GETDATE()
    WHERE  ID = @ID;

    SELECT @ID;
END
GO

/*=============================================================================
  CALENDAR
=============================================================================*/

IF OBJECT_ID('dbo.SP_GET_EMPLOYEE_CALENDAR','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_EMPLOYEE_CALENDAR;
GO
/*  One row per employee per calendar day for the month, so the UI can paint a
    company-wide grid. EVENT_TYPE is LEAVE / HOLIDAY / OPTIONAL_HOLIDAY.
    @USER_ID filters to a single employee's own calendar.                    */
CREATE PROCEDURE dbo.SP_GET_EMPLOYEE_CALENDAR
    @YEAR    INT,
    @MONTH   INT,
    @USER_ID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MONTH_START DATE = DATEFROMPARTS(@YEAR, @MONTH, 1);
    DECLARE @MONTH_END   DATE = EOMONTH(@MONTH_START);

    ;WITH DATES AS
    (
        SELECT @MONTH_START AS D
        UNION ALL
        SELECT DATEADD(DAY, 1, D) FROM DATES WHERE D < @MONTH_END
    )
    SELECT  D.D                              AS CALENDAR_DATE,
            'LEAVE'                          AS EVENT_TYPE,
            L.USER_ID,
            U.FIRST_NAME + ' ' + U.LAST_NAME AS EMPLOYEE_NAME,
            U.EMPLOYEE_CODE,
            NULL                             AS HOLIDAY_NAME,
            L.LEAVE_TYPE_ID,
            LT.NAME                          AS LEAVE_TYPE_NAME,
            LT.COLOR_CODE,
            L.STATUS_ID,
            S.NAME                           AS STATUS_NAME,
            L.IS_HALF_DAY,
            L.HALF_DAY_SESSION
    FROM    DATES D
    INNER JOIN dbo.EMPLOYEE_LEAVES L
           ON D.D BETWEEN L.FROM_DATE AND L.TO_DATE
          AND L.STATUS_ID IN (1, 2)
    INNER JOIN dbo.USERS        U  ON U.ID  = L.USER_ID
    INNER JOIN dbo.LEAVE_TYPES  LT ON LT.ID = L.LEAVE_TYPE_ID
    INNER JOIN dbo.LEAVE_STATUS S  ON S.ID  = L.STATUS_ID
    WHERE   (@USER_ID IS NULL OR L.USER_ID = @USER_ID)
    AND     dbo.FN_IS_WORKING_DAY(D.D) = 1

    UNION ALL

    /* Fixed company holidays - not tied to any one employee */
    SELECT  H.HOLIDAY_DATE,
            'HOLIDAY',
            NULL, NULL, NULL,
            H.NAME,
            H.LEAVE_TYPE_ID,
            LT.NAME,
            LT.COLOR_CODE,
            NULL, NULL, 0, NULL
    FROM    dbo.COMPANY_HOLIDAYS H
    INNER JOIN dbo.LEAVE_TYPES LT ON LT.ID = H.LEAVE_TYPE_ID
    WHERE   H.IS_ACTIVE    = 1
    AND     H.IS_OPTIONAL  = 0
    AND     H.HOLIDAY_DATE BETWEEN @MONTH_START AND @MONTH_END

    UNION ALL

    /* Approved / pending optional holidays, per employee */
    SELECT  H.HOLIDAY_DATE,
            'OPTIONAL_HOLIDAY',
            R.USER_ID,
            U.FIRST_NAME + ' ' + U.LAST_NAME,
            U.EMPLOYEE_CODE,
            H.NAME,
            H.LEAVE_TYPE_ID,
            LT.NAME,
            LT.COLOR_CODE,
            R.STATUS_ID,
            S.NAME,
            0, NULL
    FROM    dbo.OPTIONAL_HOLIDAY_REQUESTS R
    INNER JOIN dbo.COMPANY_HOLIDAYS H  ON H.ID  = R.HOLIDAY_ID
    INNER JOIN dbo.USERS            U  ON U.ID  = R.USER_ID
    INNER JOIN dbo.LEAVE_TYPES      LT ON LT.ID = H.LEAVE_TYPE_ID
    INNER JOIN dbo.LEAVE_STATUS     S  ON S.ID  = R.STATUS_ID
    WHERE   R.STATUS_ID IN (1, 2)
    AND     H.IS_ACTIVE = 1
    AND     H.HOLIDAY_DATE BETWEEN @MONTH_START AND @MONTH_END
    AND     (@USER_ID IS NULL OR R.USER_ID = @USER_ID)

    ORDER BY CALENDAR_DATE, EMPLOYEE_NAME
    OPTION (MAXRECURSION 0);
END
GO

/*=============================================================================
  DASHBOARD - BIRTHDAYS, ANNIVERSARIES, SUMMARY
=============================================================================*/

IF OBJECT_ID('dbo.SP_GET_UPCOMING_BIRTHDAYS','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_UPCOMING_BIRTHDAYS;
GO
/* Birthdays within the next @DAYS days, wrapping across the year boundary. */
CREATE PROCEDURE dbo.SP_GET_UPCOMING_BIRTHDAYS
    @DAYS INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TODAY DATE = CAST(GETDATE() AS DATE);

    ;WITH B AS
    (
        SELECT  U.ID,
                U.FIRST_NAME + ' ' + U.LAST_NAME AS EMPLOYEE_NAME,
                U.EMPLOYEE_CODE,
                U.EMAIL,
                U.DESIGNATION,
                U.DEPARTMENT,
                U.DATE_OF_BIRTH,
                /* This year's occurrence, rolled to next year if already past */
                CASE
                    WHEN DATEFROMPARTS(YEAR(@TODAY), MONTH(U.DATE_OF_BIRTH), DAY(U.DATE_OF_BIRTH)) >= @TODAY
                    THEN DATEFROMPARTS(YEAR(@TODAY),     MONTH(U.DATE_OF_BIRTH), DAY(U.DATE_OF_BIRTH))
                    ELSE DATEFROMPARTS(YEAR(@TODAY) + 1, MONTH(U.DATE_OF_BIRTH), DAY(U.DATE_OF_BIRTH))
                END AS NEXT_OCCURRENCE
        FROM    dbo.USERS U
        WHERE   U.IS_ACTIVE     = 1
        AND     U.DATE_OF_BIRTH IS NOT NULL
        /* 29 Feb birthdays are observed on 28 Feb in non-leap years */
        AND     NOT (MONTH(U.DATE_OF_BIRTH) = 2 AND DAY(U.DATE_OF_BIRTH) = 29)
    )
    SELECT  ID                AS USER_ID,
            EMPLOYEE_NAME,
            EMPLOYEE_CODE,
            EMAIL,
            DESIGNATION,
            DEPARTMENT,
            DATE_OF_BIRTH,
            CAST(NULL AS DATE) AS JOINING_DATE,
            NEXT_OCCURRENCE   AS EVENT_DATE,
            DATEDIFF(DAY, @TODAY, NEXT_OCCURRENCE) AS DAYS_AWAY,
            CAST(NULL AS INT) AS YEARS_COMPLETED
    FROM    B
    WHERE   NEXT_OCCURRENCE <= DATEADD(DAY, @DAYS, @TODAY)
    ORDER BY NEXT_OCCURRENCE;
END
GO

IF OBJECT_ID('dbo.SP_GET_WORK_ANNIVERSARIES','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_WORK_ANNIVERSARIES;
GO
CREATE PROCEDURE dbo.SP_GET_WORK_ANNIVERSARIES
    @DAYS INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TODAY DATE = CAST(GETDATE() AS DATE);

    ;WITH A AS
    (
        SELECT  U.ID,
                U.FIRST_NAME + ' ' + U.LAST_NAME AS EMPLOYEE_NAME,
                U.EMPLOYEE_CODE,
                U.EMAIL,
                U.DESIGNATION,
                U.DEPARTMENT,
                U.JOINING_DATE,
                CASE
                    WHEN DATEFROMPARTS(YEAR(@TODAY), MONTH(U.JOINING_DATE), DAY(U.JOINING_DATE)) >= @TODAY
                    THEN DATEFROMPARTS(YEAR(@TODAY),     MONTH(U.JOINING_DATE), DAY(U.JOINING_DATE))
                    ELSE DATEFROMPARTS(YEAR(@TODAY) + 1, MONTH(U.JOINING_DATE), DAY(U.JOINING_DATE))
                END AS NEXT_OCCURRENCE
        FROM    dbo.USERS U
        WHERE   U.IS_ACTIVE = 1
        AND     NOT (MONTH(U.JOINING_DATE) = 2 AND DAY(U.JOINING_DATE) = 29)
    )
    SELECT  ID              AS USER_ID,
            EMPLOYEE_NAME,
            EMPLOYEE_CODE,
            EMAIL,
            DESIGNATION,
            DEPARTMENT,
            CAST(NULL AS DATE) AS DATE_OF_BIRTH,
            JOINING_DATE,
            NEXT_OCCURRENCE AS EVENT_DATE,
            DATEDIFF(DAY, @TODAY, NEXT_OCCURRENCE)        AS DAYS_AWAY,
            DATEDIFF(YEAR, JOINING_DATE, NEXT_OCCURRENCE) AS YEARS_COMPLETED
    FROM    A
    WHERE   NEXT_OCCURRENCE <= DATEADD(DAY, @DAYS, @TODAY)
    AND     DATEDIFF(YEAR, JOINING_DATE, NEXT_OCCURRENCE) > 0
    ORDER BY NEXT_OCCURRENCE;
END
GO

IF OBJECT_ID('dbo.SP_GET_DASHBOARD_SUMMARY','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_DASHBOARD_SUMMARY;
GO
/* Single-row counters for the dashboard cards. */
CREATE PROCEDURE dbo.SP_GET_DASHBOARD_SUMMARY
    @USER_ID  INT,
    @IS_ADMIN BIT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TODAY DATE = CAST(GETDATE() AS DATE);
    DECLARE @YEAR  INT  = YEAR(@TODAY);

    SELECT
        /* Requests waiting on the admin (0 for a normal employee) */
        CASE WHEN @IS_ADMIN = 1
             THEN (SELECT COUNT(*) FROM dbo.EMPLOYEE_LEAVES WHERE STATUS_ID = 1)
             ELSE 0
        END AS PENDING_APPROVALS,

        /* This user's own pending requests */
        (SELECT COUNT(*) FROM dbo.EMPLOYEE_LEAVES
         WHERE USER_ID = @USER_ID AND STATUS_ID = 1) AS MY_PENDING_REQUESTS,

        /* Days this user has had approved this year */
        ISNULL((SELECT SUM(TOTAL_DAYS) FROM dbo.EMPLOYEE_LEAVES
                WHERE USER_ID = @USER_ID AND STATUS_ID = 2
                AND YEAR(FROM_DATE) = @YEAR), 0) AS MY_APPROVED_DAYS,

        /* Employees on leave today, company-wide */
        (SELECT COUNT(DISTINCT USER_ID) FROM dbo.EMPLOYEE_LEAVES
         WHERE STATUS_ID = 2 AND @TODAY BETWEEN FROM_DATE AND TO_DATE) AS ON_LEAVE_TODAY,

        (SELECT COUNT(*) FROM dbo.USERS WHERE IS_ACTIVE = 1) AS ACTIVE_EMPLOYEES,

        /* Next company holiday */
        (SELECT TOP 1 HOLIDAY_DATE FROM dbo.COMPANY_HOLIDAYS
         WHERE IS_ACTIVE = 1 AND IS_OPTIONAL = 0 AND HOLIDAY_DATE >= @TODAY
         ORDER BY HOLIDAY_DATE) AS NEXT_HOLIDAY_DATE,

        (SELECT TOP 1 NAME FROM dbo.COMPANY_HOLIDAYS
         WHERE IS_ACTIVE = 1 AND IS_OPTIONAL = 0 AND HOLIDAY_DATE >= @TODAY
         ORDER BY HOLIDAY_DATE) AS NEXT_HOLIDAY_NAME;
END
GO

IF OBJECT_ID('dbo.SP_GET_AUTO_EMAIL_NOTIFICATION','P') IS NOT NULL DROP PROCEDURE dbo.SP_GET_AUTO_EMAIL_NOTIFICATION;
GO
CREATE PROCEDURE dbo.SP_GET_AUTO_EMAIL_NOTIFICATION
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  ID, CODE, NAME, TO_EMAIL, CC_EMAIL, BCC_EMAIL, SUBJECT, BODY, IS_ACTIVE
    FROM    dbo.AUTO_EMAIL_NOTIFICATION
    WHERE   ID = @ID AND IS_ACTIVE = 1;
END
GO

PRINT 'HRM stored procedures created.';
GO
