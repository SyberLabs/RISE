"""Build a one-node Gemm from the JavaScript readout tensor."""

import json
import sys

try:
    import numpy as np
    import onnx
    from onnx import TensorProto, helper, numpy_helper
except ImportError as error:
    print(f'onnx package missing: {error}', file=sys.stderr)
    sys.exit(1)


def main():
    tensor_path, onnx_path = sys.argv[1], sys.argv[2]
    with open(tensor_path, encoding='utf-8') as handle:
        document = json.load(handle)
    weights = np.array(document['weights'], dtype=np.float32)
    bias = np.array(document['bias'], dtype=np.float32).reshape(1, -1)
    features, dimensions = weights.shape
    features_info = helper.make_tensor_value_info('features', TensorProto.FLOAT, [1, features])
    affect_info = helper.make_tensor_value_info('affect', TensorProto.FLOAT, [1, dimensions])
    node = helper.make_node('Gemm', ['features', 'W', 'B'], ['affect'], alpha=1.0, beta=1.0)
    graph = helper.make_graph(
        [node],
        'rise_affect_readout_v1',
        [features_info],
        [affect_info],
        [
            numpy_helper.from_array(weights, name='W'),
            numpy_helper.from_array(bias, name='B'),
        ],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 13)])
    model.ir_version = 8
    model.doc_string = document['note']
    onnx.checker.check_model(model)
    onnx.save(model, onnx_path)


if __name__ == '__main__':
    main()
