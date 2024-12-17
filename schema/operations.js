const DeviceSchema = require("../schema/devices.js").DeviceSchema;

const OperationSchema = {
    operation_id: {
        Type: "INTEGER",
        PrimaryKey: true,
        NotNull: true
    },
    device_id: {
        Type: "INTEGER",
        PrimaryKey: false,
        NotNull: true
    },
    window_name: {
        Type: "TEXT",
        PrimaryKey: false,
        NotNull: false
    },
    command: {
        Type: "TEXT",
        PrimaryKey: false,
        NotNull: false
    },
    call_id: {
        Type: "TEXT",
        PrimaryKey: false,
        NotNull: false
    },
    FOREIGN_KEY: {
        name: "device_id",
        reference: DeviceSchema.TABLE_NAME,
        reference_id: "device_id",
        on_delete: "CASCADE",
        on_update: "NO ACTION"
    },
    TABLE_NAME: "operations"
}

module.exports = {OperationSchema}