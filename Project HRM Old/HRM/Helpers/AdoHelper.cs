using Microsoft.Data.SqlClient;
using System.Data;

namespace HRM.API.Helpers
{
    public class AdoHelper
    {
        private readonly IConfiguration _configuration;

        public AdoHelper(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public SqlConnection GetConnection()
        {
            string? connectionString = _configuration.GetConnectionString("DefaultConnection");

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "Connection string 'DefaultConnection' is not configured.");
            }

            return new SqlConnection(connectionString);
        }

        public SqlCommand CreateStoredProcedureCommand(
            SqlConnection connection,
            string storedProcedureName,
            params SqlParameter[] parameters)
        {
            SqlCommand command = new SqlCommand(storedProcedureName, connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            if (parameters != null && parameters.Length > 0)
            {
                command.Parameters.AddRange(parameters);
            }

            return command;
        }

        /// <summary>
        /// Builds a parameter, mapping a CLR null onto DBNull so callers do not
        /// have to repeat the ?? (object)DBNull.Value dance.
        /// </summary>
        public static SqlParameter Parameter(string name, object? value)
        {
            return new SqlParameter(name, value ?? DBNull.Value);
        }

        public SqlDataReader ExecuteReader(SqlCommand command)
        {
            command.Connection.Open();

            return command.ExecuteReader(CommandBehavior.CloseConnection);
        }

        public int ExecuteNonQuery(SqlCommand command)
        {
            command.Connection.Open();

            return command.ExecuteNonQuery();
        }

        public object? ExecuteScalar(SqlCommand command)
        {
            command.Connection.Open();

            return command.ExecuteScalar();
        }

        /// <summary>
        /// Runs a procedure whose single result is an integer id or negative
        /// error code. Returns 0 when the procedure yields no row.
        /// </summary>
        public int ExecuteScalarInt(SqlCommand command)
        {
            object? result = ExecuteScalar(command);

            return result == null || result == DBNull.Value
                ? 0
                : Convert.ToInt32(result);
        }
    }
}
