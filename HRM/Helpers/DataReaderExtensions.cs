using System.Data;

namespace HRM.API.Helpers
{
    /// <summary>
    /// Null-safe column readers so mapping code stays free of DBNull checks.
    /// Each returns the type's default when the column is NULL or absent.
    /// </summary>
    public static class DataReaderExtensions
    {
        public static bool HasColumn(this IDataRecord reader, string name)
        {
            for (int i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        private static object? Raw(IDataRecord reader, string name)
        {
            if (!reader.HasColumn(name))
            {
                return null;
            }

            object value = reader[name];

            return value == DBNull.Value ? null : value;
        }

        public static string GetStringOrEmpty(this IDataRecord reader, string name)
        {
            return Raw(reader, name)?.ToString() ?? string.Empty;
        }

        public static string? GetStringOrNull(this IDataRecord reader, string name)
        {
            return Raw(reader, name)?.ToString();
        }

        public static int GetInt(this IDataRecord reader, string name)
        {
            object? value = Raw(reader, name);

            return value == null ? 0 : Convert.ToInt32(value);
        }

        public static int? GetIntOrNull(this IDataRecord reader, string name)
        {
            object? value = Raw(reader, name);

            return value == null ? null : Convert.ToInt32(value);
        }

        public static decimal GetDecimal(this IDataRecord reader, string name)
        {
            object? value = Raw(reader, name);

            return value == null ? 0m : Convert.ToDecimal(value);
        }

        public static bool GetBool(this IDataRecord reader, string name)
        {
            object? value = Raw(reader, name);

            return value != null && Convert.ToBoolean(value);
        }

        public static DateTime GetDateTime(this IDataRecord reader, string name)
        {
            object? value = Raw(reader, name);

            return value == null ? default : Convert.ToDateTime(value);
        }

        public static DateTime? GetDateTimeOrNull(this IDataRecord reader, string name)
        {
            object? value = Raw(reader, name);

            return value == null ? null : Convert.ToDateTime(value);
        }
    }
}
