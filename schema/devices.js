const DeviceSchema = {
    device_id: {
        Type: "INTEGER",
        PrimaryKey: true,
        NotNull: true
    },
    address: {
        Type: "TEXT",
        PrimaryKey: false,
        NotNull: true
    },
    TABLE_NAME: "devices"
}

module.exports = {DeviceSchema}